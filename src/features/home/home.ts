// Home screen (/start): a short overview of today with one-tap buttons.
import { InlineKeyboard, type Bot, type Context } from "grammy";
import { bridge, UNLINKED_MESSAGE } from "../../core/bridge.js";
import { ICON, showOrEdit } from "../../core/ui.js";
import { formatNowWib, formatDateTime, wibDate, wibHour } from "../../core/time.js";
import { CATEGORIES, ago, loadCategory } from "../news/index.js";
import { summarizeShift, type ShiftItem } from "../shifts/render.js";
import type { TaskItem } from "../tasks/tasks.js";
import type { ScheduleItem } from "../schedule/schedule.js";
import type { ReminderItem } from "../reminders/reminders.js";

interface MeResponse {
  user: { id: number; name: string; username: string };
}

function greeting(): string {
  const hour = wibHour();
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function homeKeyboard(today: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${ICON.schedule} Jadwal`, `sch:${today}`)
    .text(`${ICON.week} Minggu`, `week:${today}`)
    .row()
    .text(`${ICON.shift} Shift`, `shift:${today}`)
    .text(`${ICON.task} Tugas`, "task:list")
    .row()
    .text(`${ICON.reminder} Pengingat`, "reminder:list")
    .text(`${ICON.news} Berita`, "news:pick")
    .row()
    .text(`${ICON.add} Tambah`, "add:open")
    .text(`${ICON.refresh} Muat ulang`, "home:refresh");
}

async function renderHome(userId: number, name: string): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const today = wibDate(0);
  const indonesia = CATEGORIES[0];

  const [tasks, shifts, schedules, reminders, news] = await Promise.all([
    bridge<TaskItem[]>(userId, "GET", "/tasks"),
    bridge<ShiftItem[]>(userId, "GET", `/shifts?date=${today}`),
    bridge<ScheduleItem[]>(userId, "GET", `/schedules?date=${today}`),
    bridge<ReminderItem[]>(userId, "GET", "/reminders"),
    loadCategory(indonesia, 3),
  ]);

  const lines: string[] = [`${greeting()}, ${name}! 👋`, formatNowWib(), ""];

  if (shifts.ok) {
    const text = shifts.data.length === 0 ? "tidak ada" : shifts.data.map(summarizeShift).join(", ");
    lines.push(`${ICON.shift} Shift: ${text}`);
  }

  if (schedules.ok) {
    lines.push(`${ICON.schedule} Jadwal: ${schedules.data.length === 0 ? "tidak ada" : `${schedules.data.length} item`}`);
  }

  if (tasks.ok) {
    const high = tasks.data.filter((t) => t.priority === "high").length;
    const suffix = high > 0 ? ` (${high} prioritas tinggi)` : "";
    lines.push(`${ICON.task} Tugas belum selesai: ${tasks.data.length}${suffix}`);
  }

  if (reminders.ok && reminders.data.length > 0) {
    const next = reminders.data[0];
    lines.push(`${ICON.reminder} Berikutnya: ${formatDateTime(next.reminder_at)}, ${next.title}`);
  }

  lines.push("", `${ICON.news} Berita ${indonesia.label}`);
  if (news.items.length === 0) {
    lines.push("Belum bisa dimuat.");
  } else {
    for (const item of news.items) lines.push(`• ${item.title} (${item.source} · ${ago(item.publishedAt)})`);
  }

  lines.push("", `${ICON.expense} Keuangan: segera hadir`);

  return { text: lines.join("\n"), keyboard: homeKeyboard(today) };
}

export async function showHome(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const me = await bridge<MeResponse>(userId, "GET", "/me");

  if (!me.ok) {
    const text =
      me.reason === "unlinked"
        ? `Halo! Saya Xibra Bot.\n\n${UNLINKED_MESSAGE}`
        : me.message;
    return void (await ctx.reply(text));
  }

  const home = await renderHome(userId, me.data.user.name);
  await showOrEdit(ctx, home.text, home.keyboard);
}

export function registerHome(bot: Bot): void {
  bot.command("start", (ctx) => showHome(ctx));

  bot.callbackQuery("home:refresh", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Diperbarui" }).catch(() => undefined);
    return showHome(ctx);
  });
}

