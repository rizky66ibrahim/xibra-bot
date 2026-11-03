import { test } from "node:test";
import assert from "node:assert/strict";
import { renderShift, summarizeShift, type ShiftItem } from "../../../src/features/shifts/render.js";

const night: ShiftItem = {
  source: "block",
  code: "3",
  shift_name: "Shift 3",
  start: "20:00",
  end: "05:00",
  ends_on: "2026-11-13",
  segments: [{ start: "2026-11-12 20:00", end: "2026-11-13 05:00" }],
};

const standby: ShiftItem = {
  source: "standby",
  code: "4",
  shift_name: "Shift 4",
  start: "06:00",
  end: "02:00",
  ends_on: "2026-11-07",
  segments: [
    { start: "2026-11-06 06:00", end: "2026-11-06 12:00" },
    { start: "2026-11-07 00:00", end: "2026-11-07 02:00" },
  ],
};

test("renderShift shows the night block with its end date", () => {
  const line = renderShift(night, "2026-11-12");
  assert.match(line, /^🌙 Shift 3 {2}20:00–05:00 \(s\/d /);
});

test("renderShift shows both segments of a Friday shift", () => {
  const line = renderShift(standby, "2026-11-06");
  assert.match(line, /06:00–12:00 \+ 00:00–02:00/);
});

test("renderShift shows a day off without times", () => {
  const off: ShiftItem = { ...night, code: "libur", shift_name: "Libur (H-1)", source: "block", segments: [] };
  assert.equal(renderShift(off, "2026-11-11"), "😴 Libur (H-1)");
});

test("summarizeShift gives a short line for the home screen", () => {
  assert.equal(
    summarizeShift({ ...night, code: "2", shift_name: "Shift 2", start: "09:00:00", end: "18:00:00", segments: [] }),
    "Shift 2 09:00–18:00",
  );
});
