// Date and time helpers. Everything runs on the WIB calendar (Asia/Jakarta, UTC+7).

export const TIMEZONE = "Asia/Jakarta";

const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;

// Indonesian and English month names, lowercase
const MONTHS: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2, pebruari: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, agt: 8, ags: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, dec: 12,
};

const pad = (n: number): string => String(n).padStart(2, "0");

// YYYY-MM-DD of an instant, on the WIB calendar
export function wibDateOf(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

// Today (0), tomorrow (1), and so on, on the WIB calendar
export function wibDate(offsetDays = 0): string {
  return wibDateOf(new Date(Date.now() + offsetDays * DAY_MS));
}

// Adds days to a YYYY-MM-DD date using the WIB calendar
export function addDays(date: string, days: number): string {
  const noon = new Date(`${date}T12:00:00+07:00`).getTime();
  return wibDateOf(new Date(noon + days * DAY_MS));
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00+07:00`);
  // Rejects dates such as 2026-02-30, which JavaScript would otherwise roll over
  return !Number.isNaN(parsed.getTime()) && wibDateOf(parsed) === value;
}

export function isFriday(date: string): boolean {
  return new Date(`${date}T12:00:00+07:00`).getUTCDay() === 5;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isValidDate(iso) ? iso : null;
}

function currentYear(): number {
  return Number(wibDate(0).slice(0, 4));
}

// Accepts many date formats and returns YYYY-MM-DD, or null when not recognized.
// Examples: 2026-11-10, 10-11-2026, 10/11/26, 10112026, 10 nov, 10 november 2026, besok
export function parseFlexibleDate(input: string): string | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;

  if (text === "hari ini" || text === "today") return wibDate(0);
  if (text === "besok" || text === "tomorrow") return wibDate(1);
  if (text === "lusa") return wibDate(2);

  // ISO-like: 2026-11-10, 2026/11/10, 2026.11.10
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) return toIsoDate(+match[1], +match[2], +match[3]);

  // Day first, year optional (defaults to the current WIB year)
  match = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/.exec(text);
  if (match) {
    const year =
      match[3] === undefined ? currentYear() : match[3].length === 2 ? 2000 + +match[3] : +match[3];
    return toIsoDate(year, +match[2], +match[1]);
  }

  // Compact: 10112026 (DDMMYYYY) or 20261110 (YYYYMMDD)
  match = /^(\d{8})$/.exec(text);
  if (match) {
    const s = match[1];
    return toIsoDate(+s.slice(4), +s.slice(2, 4), +s.slice(0, 2)) ?? toIsoDate(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8));
  }

  // Month name: 10 november 2026, 10 nov, 10-nov-2026, 10 nov. 2026
  match = /^(\d{1,2})[\s\-/.]+([a-z]+)\.?(?:[\s\-/.,]+(\d{4}))?$/.exec(text);
  if (match) {
    const month = MONTHS[match[2]];
    if (!month) return null;
    return toIsoDate(match[3] ? +match[3] : currentYear(), month, +match[1]);
  }

  return null;
}

// Time part: 09:30, 9.30, jam 9, pukul 9.30, 3 sore, 9 malam, 8 pagi
const TIME_PATTERN =
  /^(?:(.*?)\s+)?(?:(?:jam|pukul|pkl)\s*)?(\d{1,2})(?:[:.](\d{2}))?(?:\s*(pagi|siang|sore|malam|subuh))?$/;

// "<date> <time>" in WIB, returned as ISO with +07:00. The date is optional and defaults to today.
export function parseWibDateTime(input: string): string | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(\d{4}-\d{2}-\d{2})t/, "$1 ");

  const match = TIME_PATTERN.exec(text);
  if (!match) return null;

  const [, rawDate = "", hhRaw, mmRaw = "00", period] = match;
  const datePart = rawDate.replace(/\b(jam|pukul|pkl)$/, "").trim();
  const day = datePart ? parseFlexibleDate(datePart) : wibDate(0);
  if (!day) return null;

  let hour = Number(hhRaw);
  const minute = Number(mmRaw);
  if (hour > 23 || minute > 59) return null;

  if (period === "pagi" || period === "subuh") {
    if (hour === 12) hour = 0;
  } else if (period === "siang" || period === "sore" || period === "malam") {
    if (hour >= 1 && hour < 12) hour += 12;
  }

  return `${day}T${pad(hour)}:${pad(minute)}:00+07:00`;
}

// "3 Nov 2026"
export function formatDateId(date: string): string {
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "Selasa, 3 November"
export function formatDayLabel(date: string): string {
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// "Selasa, 3 November 2026 · 08:16 WIB"
export function formatNowWib(): string {
  const now = new Date();
  const date = new Date(now.getTime()).toLocaleDateString("id-ID", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time} WIB`;
}

// "09:30" from an ISO timestamp, in WIB
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "3 Nov, 09.30" from an ISO timestamp, in WIB
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// "08:00:00" from the database becomes "08:00"
export function formatClock(value: string): string {
  return value.slice(0, 5);
}

// "09:30" becomes minutes since midnight, for sorting
export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

// Hour of day in WIB, 0 to 23
export function wibHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
}
