import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEveningMessage, buildMorningMessage, pickMorningLine } from "../../../src/features/checkin/messages.js";

test("morning message lists shifts, schedules, and open tasks", () => {
  const text = buildMorningMessage(
    {
      chat_id: 1,
      name: "Rizky",
      slot: "morning",
      shifts: [{ name: "Shift 2", start: "09:00", end: "18:00" }],
      schedules: [{ title: "Narik Shopee", start: "20:00", end: "22:00" }],
      tasks_open: 3,
      tasks_high: 1,
    },
    () => 0,
  );

  assert.match(text, /Selamat pagi, Rizky!/);
  assert.match(text, /Shift 2 09:00–18:00/);
  assert.match(text, /20:00–22:00  Narik Shopee/);
  assert.match(text, /Tugas belum selesai: 3 \(1 prioritas tinggi\)/);
});

test("evening message is silent when transactions and tomorrow plan exist", () => {
  assert.equal(
    buildEveningMessage({ chat_id: 1, name: "Rizky", slot: "evening", has_transactions_today: true, has_plan_tomorrow: true }),
    null,
  );
});

test("evening message asks about missing transactions and tomorrow plan", () => {
  const message = buildEveningMessage({
    chat_id: 1,
    name: "Rizky",
    slot: "evening",
    has_transactions_today: false,
    has_plan_tomorrow: false,
  });

  assert.ok(message);
  assert.match(message.text, /lupa memasukkan transaksi/);
  assert.match(message.text, /Besok belum ada jadwal/);
  assert.equal(message.showTomorrow, true);
});

test("encouragement comes from the list", () => {
  const line = pickMorningLine(() => 0.99);
  assert.equal(typeof line, "string");
  assert.ok(line.length > 0);
});
