// Shifts: daily view, log a shift (Shift 1, Shift 2, or Friday standby), and night block planning.
import { InlineKeyboard, type Bot, type Context } from "grammy";
import { bridge } from "../../core/bridge.js";
import { ICON, captured, dayOptions, resolveDay, showOrEdit, stepNavigation } from "../../core/ui.js";
import { formatDateId, formatDayLabel, isFriday, isValidDate, parseFlexibleDate, wibDate } from "../../core/time.js";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Answers, Flow } from "../../core/wizard/types.js";
import { renderShift, type ShiftItem } from "./render.js";

interface BlockPreview {
  member: string;
  member_label: string;
  starts_on: string;
  h1_date: string;
  ends_on: string;
  expected_start: string | null;
  gap_warning: boolean;
  previous: { member: string; starts_on: string; ends_on: string } | null;
}

const MEMBER_LABEL: Record<string, string> = { rizky: "Rizky", rayhand: "Rayhand", azhar: "Azhar" };

// Daily shift view with navigation and the three actions
export async function showShiftDay(ctx: Context, day: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<ShiftItem[]>(userId, "GET", `/shifts?date=${day}`);
  if (!res.ok) return void (await showOrEdit(ctx, res.message));

  const body = res.data.length === 0 ? "Tidak ada shift." : res.data.map((s) => renderShift(s, day)).join("\n");
  const text = `${ICON.shift} Shift ${formatDayLabel(day)}\n\n${body}`;

  const keyboard = stepNavigation("shift", day);
  keyboard
    .row()
    .text(`${ICON.add} Catat shift`, "shift:log")
    .text(`${ICON.nightBlock} Blok malam`, "shift:block");

  await showOrEdit(ctx, text, keyboard);
}

// Wizard: log Shift 1 or Shift 2, or the Friday standby answer
export const logShiftFlow: Flow = {
  id: "logshift",
  steps: [
    { kind: "choice", key: "dayChoice", prompt: "Shift tanggal kapan?", options: dayOptions() },
    {
      kind: "text",
      key: "customDate",
      prompt: "Tanggal berapa? Contoh: 10-11-2026 atau 10 nov.",
      validate: (v) => (parseFlexibleDate(v) ? null : "Tanggal tidak dikenali."),
      skipIf: (a) => a.dayChoice !== "custom",
    },
    {
      kind: "choice",
      key: "code",
      prompt: "Shift apa?",
      options: [
        { label: "☀️ Shift 1 · 06–15", value: "1" },
        { label: "🌤 Shift 2 · 09–18", value: "2" },
      ],
      skipIf: (a) => {
        const day = resolveDay(a);
        return !day || isFriday(day);
      },
    },
    {
      kind: "choice",
      key: "standby",
      prompt: "Jumat ini berapa orang standby?",
      options: [
        { label: "1 orang → Shift 4", value: "1" },
        { label: "2 orang → Shift 5", value: "2" },
      ],
      skipIf: (a) => {
        const day = resolveDay(a);
        return !day || !isFriday(day);
      },
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const day = resolveDay(answers);
    if (!day) return void (await ctx.reply("Tanggal tidak valid. Coba lagi dengan /shift."));

    if (isFriday(day)) {
      const count = Number(answers.standby);
      const res = await bridge<unknown>(userId, "POST", "/standby", { date: day, count });
      if (!res.ok) return void (await ctx.reply(res.message));
      const detail = count === 1 ? "Shift 4: 06–12, lalu 00–02 Sabtu" : "Shift 5: 14–02 Sabtu";
      return void (await ctx.reply(`✅ Jumat ${formatDateId(day)}: ${count} orang standby.\n${detail}`));
    }

    const res = await bridge<{ shift_name: string }>(userId, "POST", "/shifts", {
      date: day,
      shift_code: answers.code,
    });
    await ctx.reply(res.ok ? `✅ ${res.data.shift_name} dicatat untuk ${formatDateId(day)}.` : res.message);
  },
};

// Wizard: starting date of a night block. Shows a preview with Save and Cancel.
export const nightBlockFlow: Flow = {
  id: "nightblock",
  steps: [
    {
      kind: "text",
      key: "date",
      prompt: "Tanggal mulai blok malam? Contoh: 17-11-2026 atau 17 nov.",
      validate: (v) => (parseFlexibleDate(v) ? null : "Tanggal tidak dikenali."),
    },
  ],
  finish: async (ctx, answers: Answers) => {
    const userId = ctx.from?.id;
    const day = parseFlexibleDate(answers.date ?? "");
    if (userId === undefined || !day) return;

    const res = await bridge<BlockPreview>(userId, "GET", `/shift-blocks/preview?starts_on=${day}`);
    if (!res.ok) return void (await ctx.reply(res.message));

    const p = res.data;
    const lines = [
      `${ICON.nightBlock} Blok malam baru`,
      `Mulai: ${formatDateId(p.starts_on)}, 20:00`,
      `Orang: ${p.member_label}`,
      `H-1 libur: ${formatDateId(p.h1_date)}`,
      `Malam kerja: ${formatDateId(p.starts_on)} s/d ${formatDateId(p.ends_on)}, selesai 05:00 keesokan harinya`,
    ];

    if (p.previous) {
      const label = MEMBER_LABEL[p.previous.member] ?? p.previous.member;
      lines.push(`Blok sebelumnya: ${label}, ${formatDateId(p.previous.starts_on)} s/d ${formatDateId(p.previous.ends_on)}`);
    }

    if (p.gap_warning && p.expected_start) {
      lines.push(`⚠️ Blok ini seharusnya mulai ${formatDateId(p.expected_start)}. Pastikan tanggalnya benar.`);
    }

    const keyboard = new InlineKeyboard()
      .text("✅ Simpan", `shift:save:${p.starts_on}`)
      .text("✖ Batal", "shift:cancel");
    await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
  },
};

export function registerShifts(bot: Bot): void {
  registerFlow(logShiftFlow);
  registerFlow(nightBlockFlow);

  bot.command("shift", (ctx) => {
    const arg = (ctx.match ?? "").toString().trim();
    const day = arg ? parseFlexibleDate(arg) : wibDate(0);
    if (!day || !isValidDate(day)) {
      return ctx.reply("Tanggal tidak dikenali. Contoh: /shift besok atau /shift 10-11-2026.");
    }
    return showShiftDay(ctx, day);
  });

  bot.callbackQuery(/^shift:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showShiftDay(ctx, captured(ctx));
  });

  bot.callbackQuery("shift:log", (ctx) => startFlow(ctx, logShiftFlow));
  bot.callbackQuery("shift:block", (ctx) => startFlow(ctx, nightBlockFlow));

  bot.callbackQuery(/^shift:save:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const userId = ctx.from?.id;
    await ctx.answerCallbackQuery().catch(() => undefined);
    await ctx.editMessageReplyMarkup().catch(() => undefined);
    if (userId === undefined) return;

    const res = await bridge<BlockPreview>(userId, "POST", "/shift-blocks", { starts_on: captured(ctx) });
    await ctx.reply(
      res.ok
        ? `✅ Blok malam disimpan: ${res.data.member_label} mulai ${formatDateId(captured(ctx))}.`
        : res.message,
    );
  });

  bot.callbackQuery("shift:cancel", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await ctx.editMessageReplyMarkup().catch(() => undefined);
    await ctx.reply("Blok malam dibatalkan. Tidak ada yang disimpan.");
  });
}

