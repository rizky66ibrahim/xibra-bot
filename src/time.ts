const TZ = "Asia/Jakarta";
const DAY_MS = 86_400_000;
const WIB_MS = 7 * 3_600_000;

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

// "2026-11-03 09:30" atau "2026-11-03T09:30" menjadi ISO dengan offset WIB
export function parseWibDateTime(input: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(input.trim());
  if (!match) return null;

  const [, date, time] = match;
  if (!isValidDate(date)) return null;

  const iso = `${date}T${time}:00+07:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
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
export function formatShiftTime(value: string): string {
  return value.slice(0, 5);
}
