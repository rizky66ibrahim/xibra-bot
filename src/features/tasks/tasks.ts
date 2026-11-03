// Tasks: list with one-tap completion, and the add-task wizard.
import { InlineKeyboard, type Bot, type Context } from "grammy";
import { bridge } from "../../core/bridge.js";
import { ICON, PRIORITY_ICON, captured, dayOptions, resolveDay, showOrEdit } from "../../core/ui.js";
import { formatDateId } from "../../core/time.js";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Flow } from "../../core/wizard/types.js";

export interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  is_completed: boolean;
}

const MAX_BUTTONS = 8;

function renderTasks(tasks: TaskItem[]): string {
  if (tasks.length === 0) return `${ICON.task} Tidak ada tugas yang belum selesai.`;

  const lines = tasks.map((task) => {
    const icon = PRIORITY_ICON[task.priority ?? ""] ?? "⚪";
    const due = task.due_date ? `  (tenggat ${formatDateId(task.due_date)})` : "";
    return `#${task.id} ${icon} ${task.title}${due}`;
  });

  return [`${ICON.task} Tugas belum selesai`, "", ...lines].join("\n");
}

// Shows open tasks, with one button per task to mark it done
export async function showTasks(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<TaskItem[]>(userId, "GET", "/tasks");
  if (!res.ok) return void (await showOrEdit(ctx, res.message));

  const shown = res.data.slice(0, MAX_BUTTONS);
  const keyboard = new InlineKeyboard();
  shown.forEach((task, i) => {
    keyboard.text(`✓ #${task.id}`, `task:done:${task.id}`);
    if (i % 4 === 3) keyboard.row();
  });
  keyboard.row().text(`${ICON.add} Tambah tugas`, "add:open");

  await showOrEdit(ctx, renderTasks(res.data), keyboard);
}

export const addTaskFlow: Flow = {
  id: "addtask",
  steps: [
    {
      kind: "text",
      key: "title",
      prompt: "Apa judul tugasnya?",
      validate: (v) => (v.length === 0 || v.length > 255 ? "Judul wajib diisi, maksimal 255 karakter." : null),
    },
    {
      kind: "choice",
      key: "priority",
      prompt: "Prioritasnya?",
      options: [
        { label: "🟢 Rendah", value: "low" },
        { label: "🟡 Sedang", value: "medium" },
        { label: "🔴 Tinggi", value: "high" },
      ],
    },
    {
      kind: "choice",
      key: "dayChoice",
      prompt: "Tenggatnya kapan?",
      options: [{ label: "Tidak ada", value: "none" }, ...dayOptions()],
    },
    {
      kind: "text",
      key: "customDate",
      prompt: "Tanggal tenggatnya? Contoh: 10-11-2026 atau 10 nov.",
      validate: (v) => (resolveDay({ dayChoice: "custom", customDate: v }) ? null : "Tanggal tidak dikenali."),
      skipIf: (a) => a.dayChoice !== "custom",
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const due = answers.dayChoice === "none" ? undefined : resolveDay(answers) ?? undefined;

    const res = await bridge<TaskItem>(userId, "POST", "/tasks", {
      title: answers.title,
      priority: answers.priority,
      due_date: due,
    });

    if (!res.ok) return void (await ctx.reply(res.message));
    await ctx.reply(`${ICON.task} Tugas #${res.data.id} dibuat: ${res.data.title}`);
  },
};

export function registerTasks(bot: Bot): void {
  registerFlow(addTaskFlow);

  bot.command("task", (ctx) => showTasks(ctx));

  bot.callbackQuery("task:list", (ctx) => {
    void ctx.answerCallbackQuery().catch(() => undefined);
    return showTasks(ctx);
  });

  bot.callbackQuery(/^task:done:(\d+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    const id = captured(ctx);
    if (userId === undefined) return;

    const res = await bridge<unknown>(userId, "POST", `/tasks/${id}/complete`);
    await ctx.answerCallbackQuery({ text: res.ok ? "Tugas selesai" : res.message }).catch(() => undefined);
    if (res.ok) await showTasks(ctx);
  });

  bot.command("done", async (ctx) => {
    const id = Number((ctx.match ?? "").toString().trim());
    const userId = ctx.from?.id;
    if (!Number.isInteger(id) || id <= 0 || userId === undefined) {
      return ctx.reply("Format: /done <id>. Lihat id tugas di /task.");
    }
    const res = await bridge<unknown>(userId, "POST", `/tasks/${id}/complete`);
    await ctx.reply(res.ok ? `${ICON.task} Tugas #${id} selesai.` : res.message);
  });
}

export function startAddTask(ctx: Context): Promise<void> {
  return startFlow(ctx, addTaskFlow);
}
