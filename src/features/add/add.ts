// /add: one entry point for tasks, schedules, and reminders.
import type { Bot, Context } from "grammy";
import { startFlow, registerFlow } from "../../core/wizard/engine.js";
import type { Flow } from "../../core/wizard/types.js";
import { addTaskFlow } from "../tasks/tasks.js";
import { addScheduleFlow } from "../schedule/schedule.js";
import { addReminderFlow } from "../reminders/reminders.js";

const chooser: Flow = {
  id: "add",
  steps: [
    {
      kind: "choice",
      key: "what",
      prompt: "Mau tambah apa?",
      options: [
        { label: "✅ Tugas", value: "task" },
        { label: "📅 Jadwal", value: "schedule" },
        { label: "⏰ Pengingat", value: "reminder" },
      ],
    },
  ],
  finish: async (ctx, answers) => {
    if (answers.what === "task") return startFlow(ctx, addTaskFlow);
    if (answers.what === "schedule") return startFlow(ctx, addScheduleFlow);
    return startFlow(ctx, addReminderFlow);
  },
};

function openChooser(ctx: Context): Promise<void> {
  return startFlow(ctx, chooser);
}

export function registerAdd(bot: Bot): void {
  registerFlow(chooser);
  registerFlow(addTaskFlow);
  registerFlow(addScheduleFlow);
  registerFlow(addReminderFlow);

  bot.command("add", (ctx) => openChooser(ctx));
  bot.callbackQuery("add:open", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return openChooser(ctx);
  });
}
