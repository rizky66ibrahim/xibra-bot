// Pure message builders for the daily check-ins. No Telegram calls here, so this is easy to test.
import { formatDayLabel, wibDate } from "../../core/time.js";

export interface MorningPayload {
  chat_id: number;
  name: string;
  slot: "morning";
  shifts: Array<{ name: string; start: string | null; end: string | null }>;
  schedules: Array<{ title: string; start: string; end: string }>;
  tasks_open: number;
  tasks_high: number;
}

export interface EveningPayload {
  chat_id: number;
  name: string;
  slot: "evening";
  has_transactions_today: boolean;
  has_plan_tomorrow: boolean;
}

export type CheckinPayload = MorningPayload | EveningPayload;

// Short encouragement for the morning message. Kept in the bot, separate from the API reminder texts.
const MORNING_LINES = [
  "Hari ini kamu pasti bisa menyelesaikannya 💪",
  "Satu langkah kecil dulu, hasilnya menyusul ✨",
  "Fokus pada yang paling penting hari ini 🎯",
  "Mulai pelan-pelan, lalu gas pelan-pelan juga 🚀",
  "Kamu sudah siap, ayo mulai ☀️",
];

export function pickMorningLine(random: () => number = Math.random): string {
  return MORNING_LINES[Math.floor(random() * MORNING_LINES.length)];
}

export function buildMorningMessage(p: MorningPayload, random: () => number = Math.random): string {
  const lines: string[] = [`☀️ Selamat pagi, ${p.name}!`, formatDayLabel(wibDate(0)), ""];

  if (p.shifts.length === 0) {
    lines.push("🕒 Shift: tidak ada");
  } else {
    lines.push(`🕒 Shift: ${p.shifts.map((s) => (s.start && s.end ? `${s.name} ${s.start}–${s.end}` : s.name)).join(", ")}`);
  }

  if (p.schedules.length === 0) {
    lines.push("📅 Jadwal: tidak ada");
  } else {
    lines.push("📅 Jadwal:");
    for (const s of p.schedules) lines.push(`   ${s.start}–${s.end}  ${s.title}`);
  }

  const high = p.tasks_high > 0 ? ` (${p.tasks_high} prioritas tinggi)` : "";
  lines.push(`✅ Tugas belum selesai: ${p.tasks_open}${high}`);

  lines.push("", pickMorningLine(random));
  return lines.join("\n");
}

// Returns null when there is nothing to ask, so the bot stays quiet
export function buildEveningMessage(p: EveningPayload): { text: string; showTomorrow: boolean } | null {
  const questions: string[] = [];

  if (!p.has_transactions_today) {
    questions.push(`Hi ${p.name}, apakah kamu lupa memasukkan transaksi untuk hari ini? Catat dengan /expense 25k keterangan.`);
  }

  if (!p.has_plan_tomorrow) {
    questions.push("Besok belum ada jadwal atau shift. Mau dicek sekarang?");
  }

  if (questions.length === 0) return null;

  return {
    text: ["🌙 Pengecekan sore", "", ...questions].join("\n"),
    showTomorrow: !p.has_plan_tomorrow,
  };
}
