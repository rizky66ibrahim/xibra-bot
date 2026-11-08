// Schedule: one day at a time, with previous/next, edit, and delete.
import type { Bot, Context } from "grammy";
import { bridge } from "../../core/bridge.js";
import { shorten } from "../../core/text.js";
import {
  ICON,
  captured,
  confirmKeyboard,
  dayOptions,
  resolveDay,
  showOrEdit,
  stepNavigation,
  viewAndHome,
  withFooter,
} from "../../core/ui.js";
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

const validName = (v: string): string | null =>
  v.length === 0 || v.length > 255 ? "Nama wajib diisi, maksimal 255 karakter." : null;

const validTime = (v: string): string | null =>
  parseWibDateTime(`${wibDate(0)} ${v}`) ? null : "Format jam tidak dikenali. Contoh: 09:00 atau 9 pagi.";

const validCustomDate = (v: string): string | null =>
  resolveDay({ dayChoice: "custom", customDate: v }) ? null : "Tanggal tidak dikenali.";

// Shows the schedule of one day, with an edit and a delete button per item
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

  for (const s of res.data.slice(0, 8)) {
    keyboard
      .row()
      .text(`✏️ ${shorten(s.title, 24)}`, `sch:edit:${s.id}:${day}`)
      .text("🗑", `sch:del:${s.id}:${day}`);
  }

  keyboard.row().text(`${ICON.add} Tambah jadwal`, "add:open");

  await showOrEdit(ctx, `${header}\n\n${body}`, withFooter(keyboard, `sch:${day}`));
}

async function confirmDelete(ctx: Context, id: string, day: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<ScheduleItem[]>(userId, "GET", `/schedules?date=${day}`);
  const item = res.ok ? res.data.find((s) => String(s.id) === id) : undefined;
  if (!item) return showSchedule(ctx, day);

  await showOrEdit(
    ctx,
    `Hapus jadwal ini?\n${formatTime(item.start_time)}–${formatTime(item.end_time)}  ${item.title}\n\nPengingatnya ikut terhapus.`,
    confirmKeyboard(`sch:delyes:${item.id}:${day}`, `sch:${day}`),
  );
}

export const addScheduleFlow: Flow = {
  id: "addschedule",
  steps: [
    { kind: "text", key: "title", prompt: "Nama jadwalnya?", validate: validName },
    { kind: "choice", key: "dayChoice", prompt: "Tanggal kapan?", options: dayOptions() },
    {
      kind: "text",
      key: "customDate",
      prompt: "Tanggal berapa? Contoh: 10-11-2026 atau 10 nov.",
      validate: validCustomDate,
      skipIf: (a) => a.dayChoice !== "custom",
    },
    { kind: "text", key: "start", prompt: "Jam mulai? Contoh: 09:00 atau 9 pagi.", validate: validTime },
    { kind: "text", key: "end", prompt: "Jam selesai? Contoh: 10:30 atau 3 sore.", validate: validTime },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const day = resolveDay(answers);
    const start = day ? parseWibDateTime(`${day} ${answers.start}`) : null;
    const end = day ? parseWibDateTime(`${day} ${answers.end}`) : null;
    if (!day || !start || !end) return void (await ctx.reply("Data belum lengkap. Coba lagi dengan /add."));
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      return void (await ctx.reply("Jam selesai harus setelah jam mulai. Coba lagi dengan /add."));
    }

    const res = await bridge<ScheduleItem>(userId, "POST", "/schedules", {
      title: answers.title,
      start_time: start,
      end_time: end,
    });

    if (!res.ok) return void (await ctx.reply(res.message));
    await ctx.reply(`${ICON.schedule} Jadwal dibuat: ${res.data.title}, ${formatDayLabel(day)}`, {
      reply_markup: viewAndHome(`${ICON.schedule} Lihat jadwal`, `sch:${day}`),
    });
  },
};

// Edit wizard. "id" and "day" (the day being viewed) arrive as prefilled answers.
export const editScheduleFlow: Flow = {
  id: "editschedule",
  steps: [
    {
      kind: "choice",
      key: "field",
      prompt: "Apa yang ingin diubah?",
      options: [
        { label: "✏️ Nama", value: "title" },
        { label: "🕒 Tanggal dan jam", value: "when" },
      ],
    },
    { kind: "text", key: "title", prompt: "Nama barunya?", validate: validName, skipIf: (a) => a.field !== "title" },
    {
      kind: "choice",
      key: "dayChoice",
      prompt: "Tanggal barunya?",
      options: dayOptions(),
      skipIf: (a) => a.field !== "when",
    },
    {
      kind: "text",
      key: "customDate",
      prompt: "Tanggal berapa? Contoh: 10-11-2026 atau 10 nov.",
      validate: validCustomDate,
      skipIf: (a) => a.field !== "when" || a.dayChoice !== "custom",
    },
    {
      kind: "text",
      key: "start",
      prompt: "Jam mulai barunya? Contoh: 09:00 atau 9 pagi.",
      validate: validTime,
      skipIf: (a) => a.field !== "when",
    },
    {
      kind: "text",
      key: "end",
      prompt: "Jam selesai barunya? Contoh: 10:30 atau 3 sore.",
      validate: validTime,
      skipIf: (a) => a.field !== "when",
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined || !answers.id) return;

    let body: Record<string, unknown>;
    let viewDay = answers.day ?? wibDate(0);

    if (answers.field === "title") {
      body = { title: answers.title };
    } else {
      const day = resolveDay(answers);
      const start = day ? parseWibDateTime(`${day} ${answers.start}`) : null;
      const end = day ? parseWibDateTime(`${day} ${answers.end}`) : null;
      if (!day || !start || !end) return void (await ctx.reply("Data belum lengkap. Coba lagi dari jadwal."));
      if (new Date(end).getTime() <= new Date(start).getTime()) {
        return void (await ctx.reply("Jam selesai harus setelah jam mulai. Coba lagi dari jadwal."));
      }
      body = { start_time: start, end_time: end };
      viewDay = day;
    }

    const res = await bridge<ScheduleItem>(userId, "PUT", `/schedules/${answers.id}`, body);
    if (!res.ok) return void (await ctx.reply(res.message));

    await ctx.reply(`✏️ Jadwal diperbarui: ${res.data.title}`, {
      reply_markup: viewAndHome(`${ICON.schedule} Lihat jadwal`, `sch:${viewDay}`),
    });
  },
};

export function registerSchedule(bot: Bot): void {
  registerFlow(addScheduleFlow);
  registerFlow(editScheduleFlow);

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

  bot.callbackQuery(/^sch:edit:(\d+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startFlow(ctx, editScheduleFlow, { id: captured(ctx, 1), day: captured(ctx, 2) });
  });

  bot.callbackQuery(/^sch:del:(\d+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return confirmDelete(ctx, captured(ctx, 1), captured(ctx, 2));
  });

  bot.callbackQuery(/^sch:delyes:(\d+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const res = await bridge<unknown>(userId, "DELETE", `/schedules/${captured(ctx, 1)}`);
    await ctx.answerCallbackQuery({ text: res.ok ? "Jadwal dihapus" : res.message }).catch(() => undefined);
    await showSchedule(ctx, captured(ctx, 2));
  });
}

export function startAddSchedule(ctx: Context): Promise<void> {
  return startFlow(ctx, addScheduleFlow);
}

