import { test } from "node:test";
import assert from "node:assert/strict";
import { shorten } from "../../src/core/text.js";

test("short text is returned as it is", () => {
  assert.equal(shorten("Cek email", 20), "Cek email");
});

test("long text is cut to the limit and ends with an ellipsis", () => {
  const result = shorten("Bayar tagihan listrik dan internet bulan ini", 20);
  assert.equal(result.length, 20);
  assert.ok(result.endsWith("…"));
});

test("extra spaces and line breaks are collapsed", () => {
  assert.equal(shorten("  Cek \n  email  ", 20), "Cek email");
});
