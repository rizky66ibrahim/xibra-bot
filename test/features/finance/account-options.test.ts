import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUnits } from "../../../src/core/money.js";
import {
  ACCOUNT_TYPES,
  BANKS,
  EWALLETS,
  buildAccountPayload,
  parseBalance,
} from "../../../src/features/finance/account-options.js";

test("bank list has the six common banks plus a free-text option", () => {
  assert.deepEqual(
    BANKS.map((b) => b.value),
    ["BCA", "SeaBank", "Danamon", "BRI", "BNI", "OCBC", "other"],
  );
  assert.equal(EWALLETS.at(-1)?.value, "other");
  assert.equal(ACCOUNT_TYPES.length, 4);
});

test("parseBalance accepts zero and normal amounts only", () => {
  assert.equal(parseBalance("0"), 0);
  assert.equal(parseBalance("250k"), 250000);
  assert.equal(parseBalance("400rb"), 400000);
  assert.equal(parseBalance("Dompet"), null);
  assert.equal(parseBalance("-5"), null);
});

test("parseUnits accepts decimals with comma or dot", () => {
  assert.equal(parseUnits("100"), 100);
  assert.equal(parseUnits("0,05"), 0.05);
  assert.equal(parseUnits("1.25"), 1.25);
  assert.equal(parseUnits("0"), null);
  assert.equal(parseUnits("abc"), null);
});

test("cash needs no name: it is always called Tunai", () => {
  assert.deepEqual(buildAccountPayload({ type: "cash", balance: "60k" }), {
    name: "Tunai",
    type: "cash",
    balance: 60000,
  });
});

test("bank picked from the list uses the bank as name and provider", () => {
  assert.deepEqual(buildAccountPayload({ type: "bank", bank: "BCA", balance: "400rb" }), {
    name: "BCA",
    type: "bank",
    provider: "BCA",
    balance: 400000,
  });
});

test("bank typed by hand uses the typed name", () => {
  const payload = buildAccountPayload({ type: "bank", bank: "other", bankCustom: " Bank Jago ", balance: "0" });
  assert.equal(payload?.name, "Bank Jago");
  assert.equal(payload?.balance, 0);
});

test("e-wallet works the same way", () => {
  assert.equal(buildAccountPayload({ type: "ewallet", ewallet: "GoPay", balance: "50k" })?.name, "GoPay");
  assert.equal(
    buildAccountPayload({ type: "ewallet", ewallet: "other", ewalletCustom: "Jenius", balance: "1jt" })?.name,
    "Jenius",
  );
});

test("investment is described by units and price, never by a balance", () => {
  assert.deepEqual(
    buildAccountPayload({
      type: "investment",
      assetClass: "saham",
      assetName: "BBCA",
      units: "100",
      unitPrice: "9500",
    }),
    { name: "BBCA", type: "investment", asset_class: "saham", units: 100, unit_price: 9500 },
  );
});

test("incomplete answers give no payload", () => {
  assert.equal(buildAccountPayload({ type: "bank", bank: "BCA" }), null);
  assert.equal(buildAccountPayload({ type: "bank", bank: "other", balance: "10k" }), null);
  assert.equal(buildAccountPayload({ type: "investment", assetName: "BBCA", units: "100" }), null);
  assert.equal(buildAccountPayload({}), null);
});
