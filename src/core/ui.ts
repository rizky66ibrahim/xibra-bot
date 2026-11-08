// Shared UI components: icons, day pickers, navigation, and message editing.

import { InlineKeyboard, type Context } from "grammy";
import { addDays, parseFlexibleDate, wibDate, formatDateId } from "./time.js";
import type { Answers, Option } from "./wizard/types.js";

// Centralized icons used throughout Xibra Bot.
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

  weather: "🌦️",
  location: "📍",
  temperature: "🌡️",
  rain: "🌧️",
  wind: "💨",
  humidity: "💧",

  add: "➕",
  refresh: "↻",
  prev: "◀",
  next: "▶",
  cancel: "✖",
  home: "🏠",
} as const;

// Priority indicators.
export const PRIORITY_ICON: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🔴",
};

// Day choices used by wizards.
export function dayOptions(): Option[] {
  return [
    {
      label: `Hari ini · ${formatDateId(wibDate(0))}`,
      value: "today",
    },
    {
      label: `Besok · ${formatDateId(wibDate(1))}`,
      value: "tomorrow",
    },
    {
      label: `Lusa · ${formatDateId(wibDate(2))}`,
      value: "dayafter",
    },
    {
      label: "📅 Tanggal lain",
      value: "custom",
    },
  ];
}

// Resolve selected day into YYYY-MM-DD.
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

// Previous / today / next navigation.
export function stepNavigation(
  prefix: string,
  date: string,
  stepDays = 1,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${ICON.prev} Sebelumnya`, `${prefix}:${addDays(date, -stepDays)}`)
    .text("Hari ini", `${prefix}:${wibDate(0)}`)
    .text(`Berikutnya ${ICON.next}`, `${prefix}:${addDays(date, stepDays)}`);
}

// Extract the first capture group from a callback regex match.
export function captured(ctx: Context, index = 1): string {
  const match = ctx.match;

  if (!Array.isArray(match) || index < 0) {
    return "";
  }

  const value = match[index];

  return value !== undefined && value !== null ? String(value) : "";
}

// Edit an existing callback message or send a new message.
// Supports HTML formatting when explicitly requested.
export async function showOrEdit(
  ctx: Context,
  text: string,
  keyboard?: InlineKeyboard,
  format?: { html?: boolean },
): Promise<void> {
  const options = {
    ...(keyboard ? { reply_markup: keyboard } : {}),
    ...(format?.html
      ? {
          parse_mode: "HTML" as const,
          link_preview_options: {
            is_disabled: true,
          },
        }
      : {}),
  };

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, options);
      await ctx.answerCallbackQuery().catch(() => undefined);
      return;
    } catch (err) {
      const message = String((err as Error).message ?? err);

      // No need to send another message when content is unchanged.
      if (message.includes("message is not modified")) {
        await ctx.answerCallbackQuery().catch(() => undefined);
        return;
      }

      // Acknowledge callback before falling back to a new message.
      await ctx.answerCallbackQuery().catch(() => undefined);
    }
  }

  await ctx.reply(text, options);
}

// Standard footer for result screens.
export function withFooter(
  keyboard: InlineKeyboard,
  refreshData?: string,
): InlineKeyboard {
  keyboard.row();

  if (refreshData) {
    keyboard.text(`${ICON.refresh} Muat Ulang`, refreshData);
  }

  return keyboard.text(`${ICON.home} Menu Utama`, "home:refresh");
}

// Confirmation keyboard for destructive actions.
export function confirmKeyboard(
  yesData: string,
  backData: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .text("🗑 Ya, hapus", yesData)
    .text(`${ICON.cancel} Batal`, backData);
}

// Buttons under a completed action.
export function viewAndHome(
  viewLabel: string,
  viewData: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(viewLabel, viewData)
    .text(`${ICON.home} Menu Utama`, "home:refresh");
}
