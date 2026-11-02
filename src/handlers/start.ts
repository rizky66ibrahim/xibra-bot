import { InlineKeyboard, type Context } from "grammy";
import { bridge } from "../bridge.js";
import { PAIR_HINT } from "./menu.js";
import type { TaskItem } from "./tasks.js";
import {
  formatShiftTime,
  formatWibDateTime,
  formatWibDayLabel,
  wibDate,
} from "../time.js";

import type { ReminderItem, ScheduleItem } from "./planner.js";
import type { ShiftItem } from "./shifts.js";

interface MeResponse {
  user: { id: number; name: string; username: string };
}

// Salam berdasarkan jam WIB
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export async function showStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const me = await bridge<MeResponse>(userId, "GET", "/me");

  if (!me.ok) {
    if (me.reason === "unlinked") {
      await ctx.reply(`Halo! Saya Xibra Bot.\n\n${PAIR_HINT}`);
      return;
    }
    await ctx.reply(me.message);
    return;
  }

  const today = wibDate(0);

  const [tasks, shifts, schedules, reminders] = await Promise.all([
    bridge<TaskItem[]>(userId, "GET", "/tasks"),
    bridge<ShiftItem[]>(userId, "GET", `/shifts?date=${today}`),
    bridge<ScheduleItem[]>(userId, "GET", `/schedules?date=${today}`),
    bridge<ReminderItem[]>(userId, "GET", "/reminders"),
  ]);

  const lines: string[] = [
    `${greeting()}, ${me.data.user.name}! 👋`,
    "",
    `📆 ${formatWibDayLabel(today)}`,
    "",
  ];

  // Shift hari ini
  if (!shifts.ok) {
    lines.push("🕒 Shift: belum bisa dimuat");
  } else if (shifts.data.length === 0) {
    lines.push("🕒 Shift: tidak ada");
  } else {
    const list = shifts.data.map((s) =>
      s.code === "libur"
        ? s.shift_name
        : `${s.shift_name} ${s.start ?? ""}–${s.end ?? ""}`,
    );
    lines.push(`🕒 Shift: ${list.join(", ")}`);
  }

  // Jadwal hari ini
  if (schedules.ok) {
    lines.push(
      `📅 Jadwal: ${schedules.data.length === 0 ? "tidak ada" : `${schedules.data.length} item`}`,
    );
  }

  // Tugas belum selesai
  if (tasks.ok) {
    const urgent = tasks.data.filter((t) => t.priority === "high").length;
    const suffix = urgent > 0 ? ` (${urgent} prioritas tinggi)` : "";
    lines.push(`📝 Tugas belum selesai: ${tasks.data.length}${suffix}`);
  }

  // Pengingat terdekat (API sudah mengurutkan dari yang paling dekat)
  if (reminders.ok && reminders.data.length > 0) {
    const next = reminders.data[0];
    lines.push(
      `⏰ Pengingat berikutnya: ${formatWibDateTime(next.reminder_at)}, ${next.title}`,
    );
  }

  const keyboard = new InlineKeyboard()
    .text("📝 Tugas", "m:todo")
    .text("📅 Jadwal", "m:jadwal")
    .row()
    .text("⏰ Pengingat", "m:pengingat")
    .text("🕒 Shift", "m:shift")
    .row()
    .text("📰 Berita", "m:news")
    .text("📋 Menu", "m:menu");

  await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
}
