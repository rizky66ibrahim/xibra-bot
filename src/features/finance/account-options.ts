// Pure data and helpers for the "add account" wizard. No Telegram calls, so it is easy to test.
import { parseIdrAmount, parseUnits } from "../../core/money.js";
import type { Answers, Option } from "../../core/wizard/types.js";

export type AccountType = "cash" | "bank" | "ewallet" | "investment";

export const ACCOUNT_TYPES: Option[] = [
  { label: "💵 Tunai", value: "cash" },
  { label: "🏦 Rekening bank", value: "bank" },
  { label: "📱 E-wallet", value: "ewallet" },
  { label: "📈 Investasi / aset", value: "investment" },
];

// The most used banking apps in Indonesia. Anything else goes through "Bank lain".
export const BANKS: Option[] = [
  { label: "BCA", value: "BCA" },
  { label: "SeaBank", value: "SeaBank" },
  { label: "Danamon", value: "Danamon" },
  { label: "BRI", value: "BRI" },
  { label: "BNI", value: "BNI" },
  { label: "OCBC", value: "OCBC" },
  { label: "✏️ Bank lain", value: "other" },
];

export const EWALLETS: Option[] = [
  { label: "ShopeePay", value: "ShopeePay" },
  { label: "OVO", value: "OVO" },
  { label: "GoPay", value: "GoPay" },
  { label: "DANA", value: "DANA" },
  { label: "LinkAja", value: "LinkAja" },
  { label: "i.Saku", value: "i.Saku" },
  { label: "✏️ Lainnya", value: "other" },
];

// "value" is what the API accepts as asset_class
export const ASSET_CLASSES: Option[] = [
  { label: "📊 Saham", value: "saham" },
  { label: "🥇 Emas", value: "emas" },
  { label: "₿ Kripto", value: "kripto" },
  { label: "📑 Reksadana", value: "reksadana" },
  { label: "✏️ Lainnya", value: "lainnya" },
];

// Body of POST /finance/accounts
export interface AccountPayload {
  name: string;
  type: AccountType;
  provider?: string;
  asset_class?: string;
  balance?: number;
  units?: number;
  unit_price?: number;
}

// "0" is a valid starting balance. Everything else goes through the IDR parser.
export function parseBalance(input: string): number | null {
  const text = input.trim();
  if (text === "0") return 0;
  return parseIdrAmount(text);
}

// Builds the API body from wizard answers, or returns null when something is missing or invalid
export function buildAccountPayload(answers: Answers): AccountPayload | null {
  const type = answers.type as AccountType | undefined;

  if (type === "cash") {
    const balance = parseBalance(answers.balance ?? "");
    return balance === null ? null : { name: "Tunai", type, balance };
  }

  if (type === "bank" || type === "ewallet") {
    const choice = type === "bank" ? answers.bank : answers.ewallet;
    const custom = type === "bank" ? answers.bankCustom : answers.ewalletCustom;
    const name = choice === "other" ? custom?.trim() : choice;
    const balance = parseBalance(answers.balance ?? "");
    if (!name || balance === null) return null;
    return { name, type, provider: name, balance };
  }

  if (type === "investment") {
    const name = answers.assetName?.trim();
    const units = parseUnits(answers.units ?? "");
    const unitPrice = parseIdrAmount(answers.unitPrice ?? "");
    if (!name || !answers.assetClass || units === null || unitPrice === null) return null;
    return { name, type, asset_class: answers.assetClass, units, unit_price: unitPrice };
  }

  return null;
}
