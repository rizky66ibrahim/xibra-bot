// /add: one button and one question, "Ada jam?".
// With a time it becomes a schedule (which also creates reminders). Without it, a task.
import type { Bot, Context } from "grammy";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Flow } from "../../core/wizard/types.js";
import { addTaskFlow } from "../tasks/tasks.js";
import { addScheduleFlow } from "../schedule/schedule.js";

const addFlow: Flow = {
  id: "add",
  steps: [
    {
      kind: "text",
      key: "title",
      prompt: "Apa yang ingin kamu tambahkan?",
      validate: (v) => (v.length === 0 || v.length > 255 ? "Judul wajib diisi, maksimal 255 karakter." : null),
    },
    {
      kind: "choice",
      key: "timed",
      prompt: "Ada jam?",
      options: [
        { label: "🕒 Ya, ada jam", value: "yes" },
        { label: "📝 Tidak, cukup tugas", value: "no" },
      ],
    },
  ],
  finish: async (ctx, answers) => {
    if (answers.timed === "yes") {
      return startFlow(ctx, addScheduleFlow, { title: answers.title });
    }
    return startFlow(ctx, addTaskFlow, { title: answers.title });
  },
};

function openAdd(ctx: Context): Promise<void> {
  return startFlow(ctx, addFlow);
}

export function registerAdd(bot: Bot): void {
  registerFlow(addFlow);

  bot.command("add", (ctx) => openAdd(ctx));
  bot.callbackQuery("add:open", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return openAdd(ctx);
  });
}
