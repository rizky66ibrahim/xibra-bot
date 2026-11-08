// Shifts: daily view with delete, log a shift (Shift 1, Shift 2, or Friday standby), and night block planning.
import { InlineKeyboard, type Bot, type Context } from "grammy";
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
import { formatDateId, formatDayLabel, isFriday, isValidDate, parseFlexibleDate, wibDate } from "../../core/time.js";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Answers, Flow } from "../../core/wizard/types.js";
import { renderShift, type ShiftItem } from "./render.js";

// Something the user entered by hand, which can be removed again
interface ShiftEntry {
  kind: "manual" | "block" | "standby";
  id: string;
  label: string;
}

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

// Daily shift view: navigation, log/change, night block, and one delete button per entered item
export async function showShiftDay(ctx: Context, day: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const [shifts, entries] = await Promise.all([
    bridge<ShiftItem[]>(userId, "GET", `/shifts?date=${day}`),
    bridge<ShiftEntry[]>(userId, "GET", `/shifts/entries?date=${day}`),
  ]);
  if (!shifts.ok) return void (await showOrEdit(ctx, shifts.message));

  const body = shifts.data.length === 0 ? "Tidak ada shift." : shifts.data.map((s) => renderShift(s, day)).join("\n");
  const text = `${ICON.shift} Shift ${formatDayLabel(day)}\n\n${body}`;

  const keyboard = stepNavigation("shift", day);
  keyboard
    .row()
    .text("✏️ Catat / ubah shift", "shift:log")
    .text(`${ICON.nightBlock} Blok malam`, "shift:block");

  // Missing entries only hide the delete buttons. The view itself still works.
  if (entries.ok) {
    for (const entry of entries.data) {
      keyboard.row().text(`🗑 ${shorten(entry.label, 40)}`, `shift:del:${entry.kind}:${entry.id}:${day}`);
    }
  }

  await showOrEdit(ctx, text, withFooter(keyboard, `shift:${day}`));
}

async function confirmDelete(ctx: Context, kind: string, id: string, day: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const entries = await bridge<ShiftEntry[]>(userId, "GET", `/shifts/entries?date=${day}`);
  const entry = entries.ok ? entries.data.find((e) => e.kind === kind && e.id === id) : undefined;
  if (!entry) return showShiftDay(ctx, day);

  const extra = kind === "block" ? "\nPengingat blok malam ini ikut terhapus." : "";
  await showOrEdit(
    ctx,
    `Hapus ini?\n${entry.label}${extra}`,
    confirmKeyboard(`shift:delyes:${kind}:${id}:${day}`, `shift:${day}`),
  );
}

// Wizard: log Shift 1 or Shift 2 (replacing an earlier one that day), or the Friday standby answer
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

    const back = viewAndHome(`${ICON.shift} Lihat shift`, `shift:${day}`);

    if (isFriday(day)) {
      const count = Number(answers.standby);
      const res = await bridge<unknown>(userId, "POST", "/standby", { date: day, count });
      if (!res.ok) return void (await ctx.reply(res.message));
      const detail = count === 1 ? "Shift 4: 06–12, lalu 00–02 Sabtu" : "Shift 5: 14–02 Sabtu";
      return void (await ctx.reply(`✅ Jumat ${formatDateId(day)}: ${count} orang standby.\n${detail}`, { reply_markup: back }));
    }

    // PUT replaces a different shift on the same day, so logging again is also how you change one
    const res = await bridge<{ shift_name: string; replaced: boolean }>(userId, "PUT", "/shifts/manual", {
      date: day,
      shift_code: answers.code,
    });
    if (!res.ok) return void (await ctx.reply(res.message));

    const note = res.data.replaced ? " (menggantikan shift sebelumnya)" : "";
    await ctx.reply(`✅ ${res.data.shift_name} dicatat untuk ${formatDateId(day)}${note}.`, { reply_markup: back });
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

  bot.callbackQuery("shift:log", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startFlow(ctx, logShiftFlow);
  });

  bot.callbackQuery("shift:block", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startFlow(ctx, nightBlockFlow);
  });

  bot.callbackQuery(/^shift:del:(manual|block|standby):([0-9-]+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return confirmDelete(ctx, captured(ctx, 1), captured(ctx, 2), captured(ctx, 3));
  });

  bot.callbackQuery(/^shift:delyes:(manual|block|standby):([0-9-]+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const res = await bridge<unknown>(
      userId,
      "DELETE",
      `/shifts/entries/${captured(ctx, 1)}/${captured(ctx, 2)}`,
    );
    await ctx.answerCallbackQuery({ text: res.ok ? "Dihapus" : res.message }).catch(() => undefined);
    await showShiftDay(ctx, captured(ctx, 3));
  });

  bot.callbackQuery(/^shift:save:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const userId = ctx.from?.id;
    await ctx.answerCallbackQuery().catch(() => undefined);
    await ctx.editMessageReplyMarkup().catch(() => undefined);
    if (userId === undefined) return;

    const startsOn = captured(ctx);
    const res = await bridge<BlockPreview>(userId, "POST", "/shift-blocks", { starts_on: startsOn });

    if (!res.ok) return void (await ctx.reply(res.message));
    await ctx.reply(`✅ Blok malam disimpan: ${res.data.member_label} mulai ${formatDateId(startsOn)}.`, {
      reply_markup: viewAndHome(`${ICON.shift} Lihat shift`, `shift:${startsOn}`),
    });
  });

  bot.callbackQuery("shift:cancel", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await ctx.editMessageReplyMarkup().catch(() => undefined);
    await ctx.reply("Blok malam dibatalkan. Tidak ada yang disimpan.");
  });
}
