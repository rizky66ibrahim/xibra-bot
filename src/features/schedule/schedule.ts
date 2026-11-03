// Schedule: one day at a time, with previous and next navigation.
import type { Bot, Context } from "grammy";
import { bridge } from "../../core/bridge.js";
import { ICON, captured, dayOptions, resolveDay, showOrEdit, stepNavigation } from "../../core/ui.js";
import { formatDayLabel, formatTime, isValidDate, parseWibDateTime, wibDate } from "../../core/time.js";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Flow } from "../../core/wizard/types.js";

export interface ScheduleItem {
  id: number;
  title: string;
  location: string | null;
  start_time: string;
  end_time: string;
}

// Shows the schedule of one day, plus navigation buttons
export async function showSchedule(ctx: Context, day: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<ScheduleItem[]>(userId, "GET", `/schedules?date=${day}`);
  if (!res.ok) return void (await showOrEdit(ctx, res.message));

  const header = `${ICON.schedule} Jadwal ${formatDayLabel(day)}`;
  const body =
    res.data.length === 0
      ? "Tidak ada jadwal."
      : res.data
          .map(
            (s) =>
              `${formatTime(s.start_time)}–${formatTime(s.end_time)}  ${s.title}${s.location ? ` · ${s.location}` : ""}`,
          )
          .join("\n");

  const keyboard = stepNavigation("sch", day);
  keyboard.row().text(`${ICON.add} Tambah jadwal`, "add:open");

  await showOrEdit(ctx, `${header}\n\n${body}`, keyboard);
}

export const addScheduleFlow: Flow = {
  id: "addschedule",
  steps: [
    {
      kind: "text",
      key: "title",
      prompt: "Nama jadwalnya?",
      validate: (v) => (v.length === 0 || v.length > 255 ? "Nama wajib diisi, maksimal 255 karakter." : null),
    },
    { kind: "choice", key: "dayChoice", prompt: "Tanggal kapan?", options: dayOptions() },
    {
      kind: "text",
      key: "customDate",
      prompt: "Tanggal berapa? Contoh: 10-11-2026 atau 10 nov.",
      validate: (v) => (resolveDay({ dayChoice: "custom", customDate: v }) ? null : "Tanggal tidak dikenali."),
      skipIf: (a) => a.dayChoice !== "custom",
    },
    {
      kind: "text",
      key: "start",
      prompt: "Jam mulai? Contoh: 09:00 atau 9 pagi.",
      validate: (v) => (parseWibDateTime(`${wibDate(0)} ${v}`) ? null : "Format jam tidak dikenali."),
    },
    {
      kind: "text",
      key: "end",
      prompt: "Jam selesai? Contoh: 10:30 atau 3 sore.",
      validate: (v) => (parseWibDateTime(`${wibDate(0)} ${v}`) ? null : "Format jam tidak dikenali."),
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const day = resolveDay(answers);
    const start = day ? parseWibDateTime(`${day} ${answers.start}`) : null;
    const end = day ? parseWibDateTime(`${day} ${answers.end}`) : null;
    if (!start || !end) return void (await ctx.reply("Data belum lengkap. Coba lagi dengan /add."));
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      return void (await ctx.reply("Jam selesai harus setelah jam mulai. Coba lagi dengan /add."));
    }

    const res = await bridge<ScheduleItem>(userId, "POST", "/schedules", {
      title: answers.title,
      start_time: start,
      end_time: end,
    });

    if (!res.ok) return void (await ctx.reply(res.message));
    await ctx.reply(`${ICON.schedule} Jadwal dibuat: ${res.data.title}, ${formatDayLabel(day ?? wibDate(0))}`);
  },
};

export function registerSchedule(bot: Bot): void {
  registerFlow(addScheduleFlow);

  bot.command("schedule", (ctx) => {
    const arg = (ctx.match ?? "").toString().trim();
    const day = arg ? resolveDay({ dayChoice: "custom", customDate: arg }) : wibDate(0);
    if (!day || !isValidDate(day)) {
      return ctx.reply("Tanggal tidak dikenali. Contoh: /schedule besok atau /schedule 10-11-2026.");
    }
    return showSchedule(ctx, day);
  });

  bot.callbackQuery(/^sch:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showSchedule(ctx, captured(ctx));
  });
}

export function startAddSchedule(ctx: Context): Promise<void> {
  return startFlow(ctx, addScheduleFlow);
}

