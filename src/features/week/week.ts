// Week view: seven days of shifts, schedule, and reminders in one message.
import type { Bot, Context } from "grammy";
import { bridge } from "../../core/bridge.js";
import { ICON, captured, showOrEdit, stepNavigation } from "../../core/ui.js";
import {
  addDays,
  clockToMinutes,
  formatDayLabel,
  formatDateId,
  formatTime,
  isFriday,
  isValidDate,
  parseFlexibleDate,
  wibDate,
  wibDateOf,
} from "../../core/time.js";
import { renderShift, type ShiftItem } from "../shifts/render.js";
import type { ScheduleItem } from "../schedule/schedule.js";
import type { ReminderItem } from "../reminders/reminders.js";

interface Row {
  minute: number;
  line: string;
}

export async function showWeek(ctx: Context, start: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const [perDay, reminders] = await Promise.all([
    Promise.all(
      days.map((day) =>
        Promise.all([
          bridge<ShiftItem[]>(userId, "GET", `/shifts?date=${day}`),
          bridge<ScheduleItem[]>(userId, "GET", `/schedules?date=${day}`),
        ]),
      ),
    ),
    bridge<ReminderItem[]>(userId, "GET", "/reminders"),
  ]);

  const out: string[] = [`${ICON.week} ${formatDateId(days[0])} – ${formatDateId(days[6])}`];

  days.forEach((day, i) => {
    const [shifts, schedules] = perDay[i];
    const rows: Row[] = [];

    if (shifts.ok) {
      rows.push(
        ...shifts.data.map((s) => ({
          minute: s.start ? clockToMinutes(s.start) : -1,
          line: renderShift(s, day),
        })),
      );
    }

    if (schedules.ok) {
      rows.push(
        ...schedules.data.map((s) => ({
          minute: clockToMinutes(formatTime(s.start_time)),
          line: `${ICON.schedule} ${formatTime(s.start_time)}–${formatTime(s.end_time)}  ${s.title}`,
        })),
      );
    }

    if (reminders.ok) {
      rows.push(
        ...reminders.data
          .filter((r) => wibDateOf(new Date(r.reminder_at)) === day)
          .map((r) => ({
            minute: clockToMinutes(formatTime(r.reminder_at)),
            line: `${ICON.reminder} ${formatTime(r.reminder_at)}  ${r.title}`,
          })),
      );
    }

    rows.sort((a, b) => a.minute - b.minute);

    out.push("", formatDayLabel(day));
    if (rows.length === 0) out.push("   —");
    for (const row of rows) out.push(`   ${row.line}`);

    // Friday shift is never guessed: remind the user to answer the standby question
    const confirmed = shifts.ok && shifts.data.some((s) => s.source === "standby" || s.source === "block");
    if (isFriday(day) && shifts.ok && !confirmed) {
      out.push("   ⚠️ Shift Jumat belum dikonfirmasi. Ketik /shift, lalu Catat shift.");
    }
  });

  const keyboard = stepNavigation("week", start, 7);
  await showOrEdit(ctx, out.join("\n"), keyboard);
}

export function registerWeek(bot: Bot): void {
  bot.command("week", (ctx) => {
    const arg = (ctx.match ?? "").toString().trim();
    const start = arg ? parseFlexibleDate(arg) : wibDate(0);
    if (!start || !isValidDate(start)) {
      return ctx.reply("Tanggal tidak dikenali. Contoh: /week atau /week 10-11-2026.");
    }
    return showWeek(ctx, start);
  });

  bot.callbackQuery(/^week:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showWeek(ctx, captured(ctx));
  });
}
