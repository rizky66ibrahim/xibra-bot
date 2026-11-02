import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatWibTime,
  isValidDate,
  parseWibDateTime,
  wibDateOf,
} from "./time.js";

test("parseWibDateTime accepts space or T and adds the WIB offset", () => {
  assert.equal(
    parseWibDateTime("2026-11-03 09:30"),
    "2026-11-03T09:30:00+07:00",
  );
  assert.equal(
    parseWibDateTime("2026-11-03T09:30"),
    "2026-11-03T09:30:00+07:00",
  );
});

test("parseWibDateTime rejects bad input", () => {
  assert.equal(parseWibDateTime("2026-13-40 10:00"), null);
  assert.equal(parseWibDateTime("2026-11-03 25:00"), null);
  assert.equal(parseWibDateTime("besok jam 9"), null);
});

test("isValidDate rejects dates that do not exist", () => {
  assert.equal(isValidDate("2026-11-03"), true);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("03-11-2026"), false);
});

test("wibDateOf uses Jakarta time, not UTC", () => {
  // 20:00 UTC adalah 03:00 WIB keesokan harinya
  assert.equal(wibDateOf(new Date("2026-11-02T20:00:00Z")), "2026-11-03");
});

test("formatWibTime converts UTC to WIB", () => {
  assert.equal(formatWibTime("2026-11-03T02:30:00Z"), "09:30");
});
