// Runs step-by-step conversations. Choice steps use buttons, text steps accept typed replies.
import { InlineKeyboard, type Context } from "grammy";
import { clearSession, getSession, saveSession } from "./state.js";
import type { Answers, Flow, Step } from "./types.js";

const flows = new Map<string, Flow>();

export function registerFlow(flow: Flow): void {
  flows.set(flow.id, flow);
}

export function getFlow(id: string): Flow | undefined {
  return flows.get(id);
}

// Callback data format: wz:<flowId>:<stepIndex>:<value>
const CALLBACK_PATTERN = /^wz:([a-z0-9]+):(\d+):(.+)$/;

// Telegram rejects some edits or alerts (old messages). That must not stop the flow.
async function tryCall(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    // ignored on purpose
  }
}

async function askStep(ctx: Context, flow: Flow, index: number): Promise<void> {
  const step: Step = flow.steps[index];

  if (step.kind === "choice") {
    const keyboard = new InlineKeyboard();
    step.options.forEach((option, i) => {
      keyboard.text(option.label, `wz:${flow.id}:${index}:${option.value}`);
      if (i % 2 === 1) keyboard.row();
    });
    keyboard.row().text("✖ Batal", `wz:${flow.id}:${index}:cancel`);
    await ctx.reply(step.prompt, { reply_markup: keyboard });
    return;
  }

  await ctx.reply(`${step.prompt}\n\nKetik jawaban, atau /cancel untuk membatalkan.`);
}

// Next step that is neither answered nor skipped
function nextActive(flow: Flow, answers: Answers, from: number): number {
  let i = from;
  while (i < flow.steps.length) {
    const step = flow.steps[i];
    const answered = answers[step.key] !== undefined;
    const skipped = step.skipIf?.(answers) ?? false;
    if (!answered && !skipped) break;
    i++;
  }
  return i;
}

export async function startFlow(ctx: Context, flow: Flow, initial: Answers = {}): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const index = nextActive(flow, initial, 0);

  if (index >= flow.steps.length) {
    clearSession(userId);
    await flow.finish(ctx, initial);
    return;
  }

  saveSession(userId, { flowId: flow.id, index, answers: { ...initial } });
  await askStep(ctx, flow, index);
}

async function advance(ctx: Context, flow: Flow, userId: number, answers: Answers, index: number): Promise<void> {
  const next = nextActive(flow, answers, index + 1);

  if (next >= flow.steps.length) {
    clearSession(userId);
    await flow.finish(ctx, answers);
    return;
  }

  saveSession(userId, { flowId: flow.id, index: next, answers });
  await askStep(ctx, flow, next);
}

// Handles wz: button presses. Returns true when the callback belonged to a wizard.
export async function handleCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  if (!data || userId === undefined) return false;

  const match = CALLBACK_PATTERN.exec(data);
  if (!match) return false;

  const [, flowId, indexRaw, value] = match;

  if (value === "cancel") {
    clearSession(userId);
    await tryCall(() => ctx.answerCallbackQuery({ text: "Dibatalkan" }));
    await tryCall(() => ctx.editMessageText("Dibatalkan."));
    return true;
  }

  const session = getSession(userId);
  const flow = getFlow(flowId);
  if (!session || !flow || session.flowId !== flowId || session.index !== Number(indexRaw)) {
    await tryCall(() => ctx.answerCallbackQuery({ text: "Sesi sudah berakhir. Ulangi perintahnya." }));
    return true;
  }

  const step = flow.steps[session.index];
  if (step.kind !== "choice" || !step.options.some((o) => o.value === value)) {
    await tryCall(() => ctx.answerCallbackQuery({ text: "Pilihan tidak valid." }));
    return true;
  }

  await tryCall(() => ctx.answerCallbackQuery());

  // Keep the chosen answer visible in the chat history
  const label = step.options.find((o) => o.value === value)?.label ?? value;
  await tryCall(() => ctx.editMessageText(`${step.prompt}\n✓ ${label}`));

  await advance(ctx, flow, userId, { ...session.answers, [step.key]: value }, session.index);
  return true;
}

// Handles typed replies. Returns true when a text step consumed the message.
export async function handleText(ctx: Context): Promise<boolean> {
  const text = ctx.message?.text;
  const userId = ctx.from?.id;
  if (text === undefined || userId === undefined) return false;

  const session = getSession(userId);
  if (!session) return false;

  const flow = getFlow(session.flowId);
  const step = flow?.steps[session.index];
  if (!flow || !step || step.kind !== "text") return false;

  const error = step.validate?.(text.trim()) ?? null;
  if (error) {
    await ctx.reply(`${error}\n\n${step.prompt}`);
    return true;
  }

  await advance(ctx, flow, userId, { ...session.answers, [step.key]: text.trim() }, session.index);
  return true;
}
