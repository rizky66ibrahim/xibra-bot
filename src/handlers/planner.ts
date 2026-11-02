import type { Context } from "grammy";
import { bridge } from "../bridge.js";
import {
  formatShiftTime,
  formatWibDateTime,
  formatWibDayLabel,
  formatWibTime,
  parseFlexibleDate,
  parseWibDateTime,
  wibDate,
  wibDateOf,
} from "../time.js";
import { startFlow } from "../wizard/engine.js";
import type { Flow } from "../wizard/types.js";
import { renderShift, type ShiftItem } from "./shifts.js";

export interface ScheduleItem {
  id: number;
  title: string;
  location: string | null;
  start_time: string;
  end_time: string;
}

export interface ReminderItem {
  id: number;
  title: string;
  reminder_at: string;
}

interface DayItem {
  minute: number;
  line: string;
}

const DAY_HINT =
  "Pakai: kosongkan (hari ini), besok, lusa, atau tanggal seperti 10-11-2026 atau 10 nov 2026.";

// Mengubah argumen seperti "besok" atau "2026-11-05" menjadi tanggal YYYY-MM-DD
function resolveDay(arg?: string): string | null {
  if (!arg) return wibDate(0);
  return parseFlexibleDate(arg);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export async function showSchedules(ctx: Context, arg?: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const day = resolveDay(arg);
  if (!day)
    return void (await ctx.reply(`Tanggal tidak dikenali. ${DAY_HINT}`));

  const res = await bridge<ScheduleItem[]>(
    userId,
    "GET",
    `/schedules?date=${day}`,
  );
  if (!res.ok) return void (await ctx.reply(res.message));

  const header = `📅 Jadwal ${formatWibDayLabel(day)}`;
  if (res.data.length === 0)
    return void (await ctx.reply(`${header}\n\nTidak ada jadwal.`));

  const lines = res.data.map(
    (s) =>
      `${formatWibTime(s.start_time)}–${formatWibTime(s.end_time)}  ${s.title}${s.location ? ` · ${s.location}` : ""}`,
  );
  await ctx.reply([header, "", ...lines].join("\n"));
}

export async function showShifts(ctx: Context, arg?: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const day = resolveDay(arg);
  if (!day) {
    return void (await ctx.reply(`Tanggal tidak dikenali. ${DAY_HINT}`));
  }

  const res = await bridge<ShiftItem[]>(userId, "GET", `/shifts?date=${day}`);

  if (!res.ok) {
    return void (await ctx.reply(res.message));
  }

  const header = `🕒 Shift ${formatWibDayLabel(day)}`;

  if (res.data.length === 0) {
    return void (await ctx.reply(`${header}\n\nTidak ada shift.`));
  }

  const lines = res.data.map((shift) => renderShift(shift, day));

  await ctx.reply([header, "", ...lines].join("\n"));
}

// Shift, jadwal, dan pengingat pada satu hari, diurutkan menurut jam
export async function showDay(ctx: Context, arg?: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const day = resolveDay(arg);
  if (!day)
    return void (await ctx.reply(`Tanggal tidak dikenali. ${DAY_HINT}`));

  const [schedules, shifts, reminders] = await Promise.all([
    bridge<ScheduleItem[]>(userId, "GET", `/schedules?date=${day}`),
    bridge<ShiftItem[]>(userId, "GET", `/shifts?date=${day}`),
    bridge<ReminderItem[]>(userId, "GET", "/reminders"),
  ]);

  if (!schedules.ok) return void (await ctx.reply(schedules.message));
  if (!shifts.ok) return void (await ctx.reply(shifts.message));
  if (!reminders.ok) return void (await ctx.reply(reminders.message));

  const items: DayItem[] = [
    ...shifts.data.map((s) => ({
      minute: s.start ? toMinutes(s.start) : -1,
      line: renderShift(s, day),
    })),
    ...schedules.data.map((s) => ({
      minute: toMinutes(formatWibTime(s.start_time)),
      line: `📅 ${formatWibTime(s.start_time)}–${formatWibTime(s.end_time)}  ${s.title}${s.location ? ` · ${s.location}` : ""}`,
    })),
    ...reminders.data
      .filter((r) => wibDateOf(new Date(r.reminder_at)) === day)
      .map((r) => ({
        minute: toMinutes(formatWibTime(r.reminder_at)),
        line: `⏰ ${formatWibTime(r.reminder_at)}  ${r.title}`,
      })),
  ].sort((a, b) => a.minute - b.minute);

  const header = `📆 ${formatWibDayLabel(day)}`;
  if (items.length === 0) {
    return void (await ctx.reply(
      `${header}\n\nTidak ada shift, jadwal, atau pengingat.`,
    ));
  }

  await ctx.reply([header, "", ...items.map((i) => i.line)].join("\n"));
}

export async function showReminders(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<ReminderItem[]>(userId, "GET", "/reminders");
  if (!res.ok) return void (await ctx.reply(res.message));

  if (res.data.length === 0) {
    await ctx.reply(
      "Tidak ada pengingat yang akan datang. Tambah dengan /ingatkan.",
    );
    return;
  }

  const lines = res.data.map(
    (r) => `⏰ ${formatWibDateTime(r.reminder_at)}  ${r.title}`,
  );
  await ctx.reply(["⏰ Pengingat mendatang", "", ...lines].join("\n"));
}

// Wizard: isi pengingat, lalu waktunya (WIB)
export const reminderFlow: Flow = {
  id: "ingatkan",
  steps: [
    {
      kind: "text",
      key: "title",
      prompt: "Apa yang perlu diingatkan?",
      validate: (value) =>
        value.length === 0 || value.length > 255
          ? "Isi wajib diisi, maksimal 255 karakter."
          : null,
    },
    {
      kind: "text",
      key: "when",
      prompt:
        "Kapan? Contoh: besok 09:00, 10 nov 2026 09:00, atau 10-11-2026 09.30",
      validate: (value) => {
        const iso = parseWibDateTime(value);
        if (!iso)
          return "Format waktu tidak dikenali. Contoh: besok 09:00 atau 10-11-2026 09.30.";
        if (new Date(iso).getTime() <= Date.now())
          return "Waktu harus di masa depan.";
        return null;
      },
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const iso = parseWibDateTime(answers.when ?? "");
    if (!iso)
      return void (await ctx.reply(
        "Waktu tidak valid. Mulai lagi dengan /ingatkan.",
      ));

    const res = await bridge<ReminderItem>(userId, "POST", "/reminders", {
      title: answers.title,
      reminder_at: iso,
    });

    await ctx.reply(
      res.ok
        ? `⏰ Pengingat dibuat: ${answers.title}, ${formatWibDateTime(res.data.reminder_at)}`
        : res.message,
    );
  },
};

export function startReminderWizard(ctx: Context): Promise<void> {
  return startFlow(ctx, reminderFlow);
}
