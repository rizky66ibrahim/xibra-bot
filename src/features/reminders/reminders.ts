// Reminders: upcoming list and the add-reminder wizard.
import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { bridge } from "../../core/bridge.js";
import { ICON, dayOptions, resolveDay, showOrEdit, withFooter } from "../../core/ui.js";
import { formatDateTime, parseWibDateTime, wibDate } from "../../core/time.js";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Flow } from "../../core/wizard/types.js";

export interface ReminderItem {
  id: number;
  title: string;
  reminder_at: string;
}

export async function showReminders(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<ReminderItem[]>(userId, "GET", "/reminders");
  if (!res.ok) return void (await showOrEdit(ctx, res.message));

  const body =
    res.data.length === 0
      ? "Tidak ada pengingat yang akan datang."
      : res.data.map((r) => `${formatDateTime(r.reminder_at)}  ${r.title}`).join("\n");

  const keyboard = withFooter(new InlineKeyboard().text(`${ICON.add} Tambah pengingat`, "add:open"), "reminder:list");
  await showOrEdit(ctx, `${ICON.reminder} Pengingat mendatang\n\n${body}`, keyboard);
}

const TIME_CHOICES = ["07:00", "08:00", "09:00", "13:00", "16:00"];

export const addReminderFlow: Flow = {
  id: "addreminder",
  steps: [
    {
      kind: "text",
      key: "title",
      prompt: "Apa yang perlu diingatkan?",
      validate: (v) => (v.length === 0 || v.length > 255 ? "Isi wajib diisi, maksimal 255 karakter." : null),
    },
    { kind: "choice", key: "dayChoice", prompt: "Kapan harinya?", options: dayOptions() },
    {
      kind: "text",
      key: "customDate",
      prompt: "Tanggal berapa? Contoh: 10-11-2026 atau 10 nov.",
      validate: (v) => (resolveDay({ dayChoice: "custom", customDate: v }) ? null : "Tanggal tidak dikenali."),
      skipIf: (a) => a.dayChoice !== "custom",
    },
    {
      kind: "choice",
      key: "time",
      prompt: "Jam berapa?",
      options: [...TIME_CHOICES.map((t) => ({ label: t, value: t })), { label: "✏️ Jam lain", value: "custom" }],
    },
    {
      kind: "text",
      key: "customTime",
      prompt: "Jam berapa? Contoh: 15:30 atau 3 sore.",
      validate: (v) => (parseWibDateTime(`${wibDate(0)} ${v}`) ? null : "Format jam tidak dikenali."),
      skipIf: (a) => a.time !== "custom",
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const day = resolveDay(answers);
    const time = answers.time === "custom" ? answers.customTime : answers.time;
    const iso = day && time ? parseWibDateTime(`${day} ${time}`) : null;
    if (!iso) return void (await ctx.reply("Data belum lengkap. Coba lagi dengan /add."));
    if (new Date(iso).getTime() <= Date.now()) {
      return void (await ctx.reply("Waktu itu sudah lewat. Coba lagi dengan /add."));
    }

    const res = await bridge<ReminderItem>(userId, "POST", "/reminders", {
      title: answers.title,
      reminder_at: iso,
    });

    if (!res.ok) return void (await ctx.reply(res.message));
    await ctx.reply(`${ICON.reminder} Pengingat dibuat: ${answers.title}, ${formatDateTime(iso)}`);
  },
};

export function registerReminders(bot: Bot): void {
  registerFlow(addReminderFlow);
  bot.command("reminder", (ctx) => showReminders(ctx));
  bot.callbackQuery("reminder:list", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showReminders(ctx);
  });
}

export function startAddReminder(ctx: Context): Promise<void> {
  return startFlow(ctx, addReminderFlow);
}
