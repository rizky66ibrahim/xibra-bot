// Shared UI pieces: icons, day pickers, navigation, and message editing.
import { InlineKeyboard, type Context } from "grammy";
import { addDays, parseFlexibleDate, wibDate, formatDateId } from "./time.js";
import type { Answers, Option } from "./wizard/types.js";

// Each feature has its own icon so buttons are easy to tell apart
export const ICON = {
  schedule: "📅",
  week: "🗓️",
  shift: "🕒",
  nightBlock: "🌙",
  task: "✅",
  reminder: "⏰",
  news: "📰",
  expense: "💰",
  email: "📧",
  add: "➕",
  refresh: "↻",
  prev: "◀",
  next: "▶",
  cancel: "✖",
} as const;

export const PRIORITY_ICON: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🔴",
};

// Day choices used by wizards: today, tomorrow, the day after, or a typed date
export function dayOptions(): Option[] {
  return [
    { label: `Hari ini · ${formatDateId(wibDate(0))}`, value: "today" },
    { label: `Besok · ${formatDateId(wibDate(1))}`, value: "tomorrow" },
    { label: `Lusa · ${formatDateId(wibDate(2))}`, value: "dayafter" },
    { label: "📅 Tanggal lain", value: "custom" },
  ];
}

// Turns the answers from dayOptions() into YYYY-MM-DD, or null
export function resolveDay(answers: Answers): string | null {
  switch (answers.dayChoice) {
    case "today":
      return wibDate(0);
    case "tomorrow":
      return wibDate(1);
    case "dayafter":
      return wibDate(2);
    case "custom":
      return answers.customDate ? parseFlexibleDate(answers.customDate) : null;
    default:
      return null;
  }
}

// Previous / today / next buttons. `prefix` is the callback prefix of the feature.
export function stepNavigation(prefix: string, date: string, stepDays = 1): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${ICON.prev} Sebelumnya`, `${prefix}:${addDays(date, -stepDays)}`)
    .text("Hari ini", `${prefix}:${wibDate(0)}`)
    .text(`Berikutnya ${ICON.next}`, `${prefix}:${addDays(date, stepDays)}`);
}

// Returns the first capture group of a callback regex match
export function captured(ctx: Context, index = 1): string {
  const match = ctx.match;
  return Array.isArray(match) && match[index] ? String(match[index]) : "";
}

// Edits the message that held the button, or sends a new one when editing is not possible.
// Pass { html: true } for messages that contain <a> or <b> tags (link previews are turned off).
export async function showOrEdit(
  ctx: Context,
  text: string,
  keyboard?: InlineKeyboard,
  format?: { html?: boolean },
): Promise<void> {
  const options = {
    ...(keyboard ? { reply_markup: keyboard } : {}),
    ...(format?.html
      ? { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } }
      : {}),
  };

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, options);
      return;
    } catch (err) {
      // Pressing a button that would show the same content: nothing to do, and no duplicate message
      if (String((err as Error).message ?? err).includes("message is not modified")) {
        await ctx.answerCallbackQuery().catch(() => undefined);
        return;
      }
    }
    await ctx.answerCallbackQuery().catch(() => undefined);
  }

  await ctx.reply(text, options);
}
