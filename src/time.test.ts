import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatWibTime,
  isValidDate,
  parseFlexibleDate,
  parseWibDateTime,
  wibDate,
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
});

test("parseWibDateTime understands spoken times", () => {
  assert.equal(
    parseWibDateTime("besok jam 9 pagi"),
    `${wibDate(1)}T09:00:00+07:00`,
  );
  assert.equal(
    parseWibDateTime("besok jam 2 sore"),
    `${wibDate(1)}T14:00:00+07:00`,
  );
  assert.equal(
    parseWibDateTime("besok 8.30 pagi"),
    `${wibDate(1)}T08:30:00+07:00`,
  );
  assert.equal(
    parseWibDateTime("10 nov 2026 jam 9 malam"),
    "2026-11-10T21:00:00+07:00",
  );
  assert.equal(
    parseWibDateTime("besok jam 12 siang"),
    `${wibDate(1)}T12:00:00+07:00`,
  );
});

test("parseWibDateTime accepts flexible dates with time", () => {
  assert.equal(
    parseWibDateTime("10 nov 2026 09:00"),
    "2026-11-10T09:00:00+07:00",
  );
  assert.equal(
    parseWibDateTime("10-11-2026 09.30"),
    "2026-11-10T09:30:00+07:00",
  );
  assert.equal(parseWibDateTime("besok 08:00"), `${wibDate(1)}T08:00:00+07:00`);
});

test("isValidDate rejects dates that do not exist", () => {
  assert.equal(isValidDate("2026-11-03"), true);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("03-11-2026"), false);
});

test("parseFlexibleDate accepts common formats", () => {
  assert.equal(parseFlexibleDate("2026-11-10"), "2026-11-10");
  assert.equal(parseFlexibleDate("10-11-2026"), "2026-11-10");
  assert.equal(parseFlexibleDate("10/11/2026"), "2026-11-10");
  assert.equal(parseFlexibleDate("10.11.26"), "2026-11-10");
  assert.equal(parseFlexibleDate("10112026"), "2026-11-10");
  assert.equal(parseFlexibleDate("20261110"), "2026-11-10");
  assert.equal(parseFlexibleDate("10 November 2026"), "2026-11-10");
  assert.equal(parseFlexibleDate("10 nov 2026"), "2026-11-10");
  assert.equal(parseFlexibleDate("10-nov-2026"), "2026-11-10");
  assert.equal(parseFlexibleDate("10 Okt. 2026"), "2026-10-10");
});

test("parseFlexibleDate rejects impossible or unknown input", () => {
  assert.equal(parseFlexibleDate("31-02-2026"), null);
  assert.equal(parseFlexibleDate("10 blabla 2026"), null);
  assert.equal(parseFlexibleDate("minggu depan"), null);
});

test("parseFlexibleDate understands relative words", () => {
  assert.equal(parseFlexibleDate("besok"), wibDate(1));
  assert.equal(parseFlexibleDate("hari ini"), wibDate(0));
});

test("wibDateOf uses Jakarta time, not UTC", () => {
  // 20:00 UTC adalah 03:00 WIB keesokan harinya
  assert.equal(wibDateOf(new Date("2026-11-02T20:00:00Z")), "2026-11-03");
});

test("formatWibTime converts UTC to WIB", () => {
  assert.equal(formatWibTime("2026-11-03T02:30:00Z"), "09:30");
});
