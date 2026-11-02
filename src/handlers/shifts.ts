import { InlineKeyboard, type Context } from "grammy";
import { bridge } from "../bridge.js";
import {
  formatDateId,
  formatWibDayLabel,
  isFriday,
  parseFlexibleDate,
  wibDate,
} from "../time.js";
import { startFlow } from "../wizard/engine.js";
import type { Flow } from "../wizard/types.js";

export interface ShiftItem {
  source: "block" | "standby" | "manual";
  code: string;
  shift_name: string;
  start: string | null;
  end: string | null;
  ends_on: string;
  segments: Array<{ start: string; end: string }>;
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

const MEMBER_LABEL: Record<string, string> = {
  rizky: "Rizky",
  rayhand: "Rayhand",
  azhar: "Azhar",
};

const ICON: Record<string, string> = {
  block: "🌙",
  standby: "🕒",
  manual: "🕒",
};

const DATE_VALIDATE = (value: string): string | null =>
  parseFlexibleDate(value)
    ? null
    : "Tanggal tidak dikenali. Contoh: 17-11-2026 atau 17 nov 2026.";

export function renderShift(s: ShiftItem, day: string): string {
  if (s.code === "libur") return `😴 ${s.shift_name}`;

  const times =
    s.segments.length > 0
      ? s.segments
          .map((g) => `${g.start.slice(11, 16)}–${g.end.slice(11, 16)}`)
          .join(" + ")
      : `${s.start}–${s.end}`;

  const spill = s.ends_on !== day ? ` (s/d ${formatDateId(s.ends_on)})` : "";
  return `${ICON[s.source] ?? "🕒"} ${s.shift_name}  ${times}${spill}`;
}

// /shift [tanggal]: hanya melihat, tidak mengubah apa pun
export async function showShifts(ctx: Context, arg?: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const day = arg ? parseFlexibleDate(arg) : wibDate(0);
  if (!day)
    return void (await ctx.reply(
      "Tanggal tidak dikenali. Contoh: besok, 10-11-2026, atau 10 nov 2026.",
    ));

  const res = await bridge<ShiftItem[]>(userId, "GET", `/shifts?date=${day}`);
  if (!res.ok) return void (await ctx.reply(res.message));

  const header = `🕒 Shift ${formatWibDayLabel(day)}`;
  if (res.data.length === 0)
    return void (await ctx.reply(`${header}\n\nTidak ada shift.`));

  await ctx.reply(
    [header, "", ...res.data.map((s) => renderShift(s, day))].join("\n"),
  );
}

// Wizard /blokmalam: tanggal mulai, lalu ringkasan dengan tombol konfirmasi
export const blokMalamFlow: Flow = {
  id: "blokmalam",
  steps: [
    {
      kind: "text",
      key: "date",
      prompt: "Tanggal mulai blok malam? Contoh: 17-11-2026 atau 17 nov 2026.",
      validate: DATE_VALIDATE,
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const day = parseFlexibleDate(answers.date ?? "");
    if (!day) return void (await ctx.reply("Tanggal tidak valid."));

    const res = await bridge<BlockPreview>(
      userId,
      "GET",
      `/shift-blocks/preview?starts_on=${day}`,
    );
    if (!res.ok) return void (await ctx.reply(res.message));

    const p = res.data;
    const lines = [
      "🌙 Blok malam baru",
      `Mulai: ${formatDateId(p.starts_on)}, 20:00`,
      `Orang: ${p.member_label}`,
      `H-1 libur: ${formatDateId(p.h1_date)}`,
      `Malam kerja: ${formatDateId(p.starts_on)} s/d ${formatDateId(p.ends_on)}, selesai 05:00 keesokan harinya`,
    ];

    if (p.previous) {
      const label = MEMBER_LABEL[p.previous.member] ?? p.previous.member;
      lines.push(
        `Blok sebelumnya: ${label}, ${formatDateId(p.previous.starts_on)} s/d ${formatDateId(p.previous.ends_on)}`,
      );
    }

    if (p.gap_warning && p.expected_start) {
      lines.push(
        `⚠️ Blok sebelumnya seharusnya selesai dan blok ini mulai ${formatDateId(p.expected_start)}. Pastikan tanggalnya benar.`,
      );
    }

    const keyboard = new InlineKeyboard()
      .text("✅ Simpan", `sb:save:${p.starts_on}`)
      .text("✖ Batal", "sb:cancel");
    await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
  },
};

export async function saveBlock(ctx: Context, startsOn: string): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  await ctx.editMessageReplyMarkup().catch(() => undefined);

  const res = await bridge<BlockPreview>(userId, "POST", "/shift-blocks", {
    starts_on: startsOn,
  });
  if (!res.ok) return void (await ctx.reply(res.message));

  await ctx.reply(
    `✅ Blok malam disimpan: ${res.data.member_label} mulai ${formatDateId(startsOn)}.`,
  );
}

export async function cancelBlock(ctx: Context): Promise<void> {
  await ctx.editMessageReplyMarkup().catch(() => undefined);
  await ctx.reply("Blok malam dibatalkan. Tidak ada yang disimpan.");
}

// Wizard /catatshift: hanya Shift 1 dan 2, Shift 4 dan 5 lewat /jumat
export const catatShiftFlow: Flow = {
  id: "catatshift",
  steps: [
    {
      kind: "text",
      key: "date",
      prompt: "Tanggal shift? Contoh: 10-11-2026 atau 10 nov 2026.",
      validate: DATE_VALIDATE,
    },
    {
      kind: "choice",
      key: "code",
      prompt: "Shift apa?",
      options: [
        { label: "☀️ Shift 1 · 06–15", value: "1" },
        { label: "🌤 Shift 2 · 09–18", value: "2" },
      ],
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const day = parseFlexibleDate(answers.date ?? "");
    if (!day) return void (await ctx.reply("Tanggal tidak valid."));

    const res = await bridge<{ shift_name: string }>(
      userId,
      "POST",
      "/shifts",
      {
        date: day,
        shift_code: answers.code,
      },
    );

    await ctx.reply(
      res.ok
        ? `✅ ${res.data.shift_name} dicatat untuk ${formatDateId(day)}.`
        : res.message,
    );
  },
};

export function nextFriday(): string {
  for (let i = 0; i < 7; i++) {
    const day = wibDate(i);
    if (isFriday(day)) return day;
  }
  return wibDate(0);
}

// Wizard /jumat: jumlah standby, hanya untuk hari Jumat
export const standbyFlow: Flow = {
  id: "jumat",
  steps: [
    {
      kind: "text",
      key: "date",
      prompt: "Hari Jumat yang mana? Contoh: 06-11-2026.",
      validate: (value) => {
        const day = parseFlexibleDate(value);
        if (!day) return "Tanggal tidak dikenali.";
        return isFriday(day) ? null : "Tanggal itu bukan hari Jumat.";
      },
    },
    {
      kind: "choice",
      key: "count",
      prompt: "Jumat ini berapa orang standby?",
      options: [
        { label: "1 orang → Shift 4", value: "1" },
        { label: "2 orang → Shift 5", value: "2" },
      ],
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const day = parseFlexibleDate(answers.date ?? "");
    if (!day) return void (await ctx.reply("Tanggal tidak valid."));

    const count = Number(answers.count);
    const res = await bridge<unknown>(userId, "POST", "/standby", {
      date: day,
      count,
    });
    if (!res.ok) return void (await ctx.reply(res.message));

    const detail =
      count === 1 ? "Shift 4: 06–12, lalu 00–02 Sabtu" : "Shift 5: 14–02 Sabtu";
    await ctx.reply(
      `✅ ${formatDateId(day)}: ${count} orang standby.\n${detail}`,
    );
  },
};

// Membuka wizard dengan tanggal dari argumen, jika ada
export function startWithDate(
  ctx: Context,
  flow: Flow,
  arg?: string,
): Promise<void> {
  if (!arg) return startFlow(ctx, flow);

  const day = parseFlexibleDate(arg);
  if (!day)
    return ctx
      .reply("Tanggal tidak dikenali. Contoh: 17-11-2026 atau 17 nov 2026.")
      .then(() => undefined);

  return startFlow(ctx, flow, { date: day });
}

export function startStandby(ctx: Context, arg?: string): Promise<void> {
  if (!arg) return startFlow(ctx, standbyFlow, { date: nextFriday() });

  const day = parseFlexibleDate(arg);
  if (!day || !isFriday(day)) {
    return ctx
      .reply(
        "Isi tanggal Jumat, contoh: 06-11-2026. Atau ketik /jumat tanpa tanggal.",
      )
      .then(() => undefined);
  }
  return startFlow(ctx, standbyFlow, { date: day });
}
