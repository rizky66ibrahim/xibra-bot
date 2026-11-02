const TZ = "Asia/Jakarta";
const DAY_MS = 86_400_000;
const WIB_MS = 7 * 3_600_000;

// Nama bulan Indonesia dan singkatannya, semua dalam huruf kecil
const MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  pebruari: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  agt: 8,
  ags: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
  dec: 12,
};

const pad = (n: number): string => String(n).padStart(2, "0");

// Tanggal YYYY-MM-DD menurut WIB untuk sebuah instan
export function wibDateOf(date: Date): string {
  return new Date(date.getTime() + WIB_MS).toISOString().slice(0, 10);
}

// Tanggal hari ini (offsetDays = 0) atau beberapa hari ke depan, menurut WIB
export function wibDate(offsetDays = 0): string {
  return wibDateOf(new Date(Date.now() + offsetDays * DAY_MS));
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00+07:00`);
  // Menolak tanggal seperti 2026-02-30 yang oleh JavaScript digeser ke bulan berikutnya
  return !Number.isNaN(parsed.getTime()) && wibDateOf(parsed) === value;
}

function toIso(year: number, month: number, day: number): string | null {
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isValidDate(iso) ? iso : null;
}

// Menerima banyak format tanggal dan mengembalikan YYYY-MM-DD, atau null jika tidak dikenali.
// Contoh: 2026-11-10, 10-11-2026, 10/11/2026, 10.11.26, 10112026, 20261110,
// 10 november 2026, 10 nov 2026, 10-nov-2026, besok, lusa, hari ini
export function parseFlexibleDate(input: string): string | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;

  if (text === "hari ini") return wibDate(0);
  if (text === "besok") return wibDate(1);
  if (text === "lusa") return wibDate(2);

  // 2026-11-10, 2026/11/10, 2026.11.10
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) return toIso(+match[1], +match[2], +match[3]);

  // 10-11-2026, 10/11/2026, 10.11.2026, 10-11-26
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
  if (match) {
    const year = match[3].length === 2 ? 2000 + +match[3] : +match[3];
    return toIso(year, +match[2], +match[1]);
  }

  // 10112026 (DDMMYYYY) atau 20261110 (YYYYMMDD)
  match = /^(\d{8})$/.exec(text);
  if (match) {
    const s = match[1];
    return (
      toIso(+s.slice(4), +s.slice(2, 4), +s.slice(0, 2)) ??
      toIso(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8))
    );
  }

  // 10 november 2026, 10 nov 2026, 10-nov-2026, 10 nov. 2026
  match = /^(\d{1,2})[\s\-/.]+([a-z]+)\.?[\s\-/.,]+(\d{4})$/.exec(text);
  if (match) {
    const month = MONTHS[match[2]];
    return month ? toIso(+match[3], month, +match[1]) : null;
  }

  return null;
}

const TIME_PATTERN =
  /^(?:(.*?)\s+)?(?:(?:jam|pukul|pkl)\s*)?(\d{1,2})(?:[:.](\d{2}))?(?:\s*(pagi|siang|sore|malam|subuh))?$/;

export function parseWibDateTime(input: string): string | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(\d{4}-\d{2}-\d{2})t/, "$1 ");

  const match = TIME_PATTERN.exec(text);
  if (!match) return null;

  const [, rawDate = "", hhRaw, mmRaw = "00", period] = match;

  // "jam" atau "pukul" yang tertinggal di bagian tanggal bukan tanggal
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

// "10 Nov 2026" dari tanggal YYYY-MM-DD
export function formatDateId(date: string): string {
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "09:30" dari timestamp ISO
export function formatWibTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "3 Nov, 09.00" dari timestamp ISO
export function formatWibDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// "Senin, 2 November" dari tanggal YYYY-MM-DD
export function formatWibDayLabel(date: string): string {
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Shift disimpan sebagai "08:00:00" tanpa tanggal
export function formatShiftTime(
  start: string | null,
  end: string | null,
  value: string,
): string {
  return value.slice(0, 5);
}

export function isFriday(date: string): boolean {
  return new Date(`${date}T12:00:00+07:00`).getUTCDay() === 5;
}
