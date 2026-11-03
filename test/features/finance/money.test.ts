import { test } from "node:test";
import assert from "node:assert/strict";
import { formatIdr, parseIdrAmount } from "../../../src/core/money.js";

test("parseIdrAmount understands shorthand and separators", () => {
  assert.equal(parseIdrAmount("25k"), 25000);
  assert.equal(parseIdrAmount("25rb"), 25000);
  assert.equal(parseIdrAmount("25 ribu"), 25000);
  assert.equal(parseIdrAmount("1,5jt"), 1500000);
  assert.equal(parseIdrAmount("1.5jt"), 1500000);
  assert.equal(parseIdrAmount("2jt"), 2000000);
  assert.equal(parseIdrAmount("25.000"), 25000);
  assert.equal(parseIdrAmount("1.250.000"), 1250000);
  assert.equal(parseIdrAmount("25000"), 25000);
});

test("parseIdrAmount rejects zero, negatives, and text", () => {
  assert.equal(parseIdrAmount("0"), null);
  assert.equal(parseIdrAmount("-5000"), null);
  assert.equal(parseIdrAmount("makan"), null);
  assert.equal(parseIdrAmount(""), null);
});

test("formatIdr uses Indonesian grouping and handles negatives", () => {
  assert.equal(formatIdr(25000), "Rp 25.000");
  assert.equal(formatIdr(-300000), "-Rp 300.000");
  assert.equal(formatIdr(0), "Rp 0");
});
