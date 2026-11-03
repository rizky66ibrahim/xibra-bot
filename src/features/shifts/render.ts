// Pure rendering helpers for shifts. No Telegram imports, so this file is easy to test.
import { formatDateId, formatClock } from "../../core/time.js";

export interface ShiftSegment {
  start: string;
  end: string;
}

// One shift as returned by GET /shifts
export interface ShiftItem {
  source: "block" | "standby" | "manual";
  code: string;
  shift_name: string;
  start: string | null;
  end: string | null;
  ends_on: string;
  segments: ShiftSegment[];
}

const SOURCE_ICON: Record<ShiftItem["source"], string> = {
  block: "🌙",
  standby: "🕒",
  manual: "🕒",
};

// Clock range of a shift, handling segments and shifts that end on the next day
function clockRange(s: ShiftItem): string {
  if (s.segments.length > 0) {
    return s.segments.map((g) => `${g.start.slice(11, 16)}–${g.end.slice(11, 16)}`).join(" + ");
  }
  return `${s.start ?? "?"}–${s.end ?? "?"}`;
}

// One line in a day view, for example "🌙 Shift 3  20:00–05:00 (s/d 4 Nov 2026)"
export function renderShift(s: ShiftItem, day: string): string {
  if (s.code === "libur") return `😴 ${s.shift_name}`;

  const spill = s.ends_on !== day ? ` (s/d ${formatDateId(s.ends_on)})` : "";
  return `${SOURCE_ICON[s.source] ?? "🕒"} ${s.shift_name}  ${clockRange(s)}${spill}`;
}

// Short form for the home screen, for example "Shift 2 09:00–18:00"
export function summarizeShift(s: ShiftItem): string {
  if (s.code === "libur") return s.shift_name;
  if (s.start && s.end) return `${s.shift_name} ${formatClock(s.start)}–${formatClock(s.end)}`;
  return s.shift_name;
}
