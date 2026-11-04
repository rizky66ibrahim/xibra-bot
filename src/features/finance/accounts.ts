// "Add account" wizard. The type is chosen first, then only the questions that type needs.
import type { Context } from "grammy";
import { bridge } from "../../core/bridge.js";
import { formatIdr, parseIdrAmount, parseUnits } from "../../core/money.js";
import { startFlow } from "../../core/wizard/engine.js";
import type { Flow } from "../../core/wizard/types.js";
import {
  ACCOUNT_TYPES,
  ASSET_CLASSES,
  BANKS,
  EWALLETS,
  buildAccountPayload,
  parseBalance,
} from "./account-options.js";

export interface AccountItem {
  id: number;
  name: string;
  type: string;
  provider: string | null;
  asset_class: string | null;
  balance: number;
  units: number | null;
  unit_price: number | null;
  price_updated_at: string | null;
  currency: string;
}

const isType = (type: string) => (a: Record<string, string>) => a.type !== type;

export const addAccountFlow: Flow = {
  id: "addaccount",
  steps: [
    { kind: "choice", key: "type", prompt: "Jenis akun apa yang ingin ditambahkan?", options: ACCOUNT_TYPES },

    // Bank: pick from the common banks, or type another name
    {
      kind: "choice",
      key: "bank",
      prompt: "Bank mana? Pilih dari daftar, atau Bank lain untuk mengetik sendiri.",
      options: BANKS,
      skipIf: isType("bank"),
    },
    {
      kind: "text",
      key: "bankCustom",
      prompt: "Nama banknya?",
      validate: (v) => (v.length === 0 || v.length > 100 ? "Nama wajib diisi, maksimal 100 karakter." : null),
      skipIf: (a) => a.type !== "bank" || a.bank !== "other",
    },

    // E-wallet
    {
      kind: "choice",
      key: "ewallet",
      prompt: "E-wallet mana?",
      options: EWALLETS,
      skipIf: isType("ewallet"),
    },
    {
      kind: "text",
      key: "ewalletCustom",
      prompt: "Nama e-walletnya?",
      validate: (v) => (v.length === 0 || v.length > 100 ? "Nama wajib diisi, maksimal 100 karakter." : null),
      skipIf: (a) => a.type !== "ewallet" || a.ewallet !== "other",
    },

    // Investment: class, name, units, and the price you know today
    {
      kind: "choice",
      key: "assetClass",
      prompt: "Jenis asetnya?",
      options: ASSET_CLASSES,
      skipIf: isType("investment"),
    },
    {
      kind: "text",
      key: "assetName",
      prompt: "Nama asetnya? Contoh: BBCA, Emas Antam, Bitcoin.",
      validate: (v) => (v.length === 0 || v.length > 100 ? "Nama wajib diisi, maksimal 100 karakter." : null),
      skipIf: isType("investment"),
    },
    {
      kind: "text",
      key: "units",
      prompt: "Berapa jumlah unitnya? Contoh: 100 (lembar), 2 (gram), 0,05 (koin).",
      validate: (v) => (parseUnits(v) ? null : "Jumlah tidak dikenali. Contoh: 100 atau 0,05."),
      skipIf: isType("investment"),
    },
    {
      kind: "text",
      key: "unitPrice",
      prompt: "Harga per unit saat ini? Contoh: 9500 atau 1,5jt.\nHarga ini bisa Anda perbarui kapan saja.",
      validate: (v) => (parseIdrAmount(v) ? null : "Harga tidak dikenali. Contoh: 9500 atau 1,5jt."),
      skipIf: isType("investment"),
    },

    // Cash, bank, and e-wallet: how much money is in it now
    {
      kind: "text",
      key: "balance",
      prompt: "Saldo saat ini? Contoh: 250k. Ketik 0 jika kosong.",
      validate: (v) => (parseBalance(v) !== null ? null : "Nominal tidak dikenali. Contoh: 250k atau 0."),
      skipIf: (a) => a.type === "investment",
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const payload = buildAccountPayload(answers);
    if (!payload) return void (await ctx.reply("Data akun belum lengkap. Coba lagi dengan /balance."));

    const res = await bridge<AccountItem>(userId, "POST", "/finance/accounts", payload);
    if (!res.ok) return void (await ctx.reply(res.message));

    const a = res.data;
    const detail =
      a.type === "investment" && a.units !== null && a.unit_price !== null
        ? `${a.units} × ${formatIdr(a.unit_price)} = ${formatIdr(a.balance)}`
        : `saldo ${formatIdr(a.balance)}`;

    await ctx.reply(`🏦 Akun dibuat: ${a.name}, ${detail}`);
  },
};

export function startAddAccount(ctx: Context): Promise<void> {
  return startFlow(ctx, addAccountFlow);
}
