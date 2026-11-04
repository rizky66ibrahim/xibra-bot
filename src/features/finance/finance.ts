// Finance: balance overview, expense and income recording, goal savings, and investment prices.
import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { bridge } from "../../core/bridge.js";
import { formatIdr, parseIdrAmount } from "../../core/money.js";
import { formatDateId, wibDateOf } from "../../core/time.js";
import { ICON, showOrEdit } from "../../core/ui.js";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Answers, Flow } from "../../core/wizard/types.js";
import { addAccountFlow, startAddAccount, type AccountItem } from "./accounts.js";

interface CategoryItem {
  id: number;
  name: string;
  type: string;
}

interface SummaryItem {
  month: string;
  income: number;
  expense: number;
  net: number;
  cash_balance: number;
  investment_value: number;
  total_balance: number;
}

interface BudgetItem {
  id: number;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
}

interface GoalItem {
  id: number;
  title: string;
  emoji: string | null;
  current_amount: number;
  target_amount: number;
}

interface TransactionResult {
  id: number;
  type: "income" | "expense";
  amount: number;
  description: string | null;
  account_name: string | null;
  balance_after: number | null;
}

const isInvestment = (a: AccountItem): boolean => a.type === "investment";

// One line per investment: "Emas Antam  Rp 3.000.000 (2 × Rp 1.500.000, harga 4 Nov 2026)"
function investmentLine(a: AccountItem): string {
  const parts =
    a.units !== null && a.unit_price !== null ? `${a.units} × ${formatIdr(a.unit_price)}` : "";
  const when = a.price_updated_at ? `harga ${formatDateId(wibDateOf(new Date(a.price_updated_at)))}` : "";
  const detail = [parts, when].filter(Boolean).join(", ");
  return `• ${a.name}  ${formatIdr(a.balance)}${detail ? ` (${detail})` : ""}`;
}

// Balance overview. Cash and bank money is shown apart from investments.
export async function showBalance(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const [accounts, summary, budgets, goals] = await Promise.all([
    bridge<AccountItem[]>(userId, "GET", "/finance/accounts"),
    bridge<SummaryItem>(userId, "GET", "/finance/summary"),
    bridge<BudgetItem[]>(userId, "GET", "/finance/budgets"),
    bridge<GoalItem[]>(userId, "GET", "/finance/goals"),
  ]);

  if (!accounts.ok) return void (await showOrEdit(ctx, accounts.message));

  const cash = accounts.data.filter((a) => !isInvestment(a));
  const investments = accounts.data.filter(isInvestment);

  const lines: string[] = [`${ICON.expense} Keuangan`, ""];

  if (accounts.data.length === 0) {
    lines.push("Belum ada akun. Tekan 🏦 Tambah akun untuk mulai.");
  }

  if (cash.length > 0) {
    lines.push("Kas & bank");
    for (const a of cash) lines.push(`• ${a.name}  ${formatIdr(a.balance)}`);
    lines.push(`Total  ${formatIdr(cash.reduce((sum, a) => sum + a.balance, 0))}`, "");
  }

  if (investments.length > 0) {
    lines.push("Investasi");
    for (const a of investments) lines.push(investmentLine(a));
    lines.push(`Total  ${formatIdr(investments.reduce((sum, a) => sum + a.balance, 0))}`, "");
  }

  if (summary.ok) {
    lines.push(`Bulan ini: masuk ${formatIdr(summary.data.income)} · keluar ${formatIdr(summary.data.expense)}`);
  }

  if (budgets.ok && budgets.data.length > 0) {
    lines.push("", "Budget");
    for (const b of budgets.data) lines.push(`• ${b.name}: ${formatIdr(b.spent)} dari ${formatIdr(b.amount)}`);
  }

  const keyboard = new InlineKeyboard()
    .text("💸 Catat pengeluaran", "fin:expense")
    .text("💵 Catat pemasukan", "fin:income")
    .row()
    .text("🏦 Tambah akun", "fin:account");

  // Buttons only appear when they can work
  if (investments.length > 0) keyboard.text("📈 Perbarui harga", "fin:price");
  keyboard.row();
  if (goals.ok && goals.data.length > 0) keyboard.text("🎯 Tabung ke goal", "fin:goal");
  keyboard.text(`${ICON.refresh} Muat ulang`, "fin:refresh");

  await showOrEdit(ctx, lines.join("\n"), keyboard);
}

// Builds a transaction wizard for the user's current accounts and categories.
// Investment accounts are left out: their value changes only through prices.
async function startTransaction(ctx: Context, type: "expense" | "income", initial: Answers = {}): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const [accounts, categories] = await Promise.all([
    bridge<AccountItem[]>(userId, "GET", "/finance/accounts"),
    bridge<CategoryItem[]>(userId, "GET", `/finance/categories?type=${type}`),
  ]);

  if (!accounts.ok) return void (await ctx.reply(accounts.message));

  const usable = accounts.data.filter((a) => !isInvestment(a));

  // No account yet: go straight to creating one instead of showing a dead end
  if (usable.length === 0) {
    await ctx.reply("Belum ada akun untuk mencatat transaksi. Buat satu dulu.");
    return startAddAccount(ctx);
  }

  const categoryOptions = categories.ok ? categories.data.map((c) => ({ label: c.name, value: String(c.id) })) : [];

  // Flow ids are per user, because account and category choices differ from user to user
  const flow: Flow = {
    id: `${type === "expense" ? "exp" : "inc"}${userId}`,
    steps: [
      {
        kind: "text",
        key: "amount",
        prompt: "Berapa nominalnya? Contoh: 25k, 1,5jt, atau 25.000",
        validate: (v) => (parseIdrAmount(v) ? null : "Nominal tidak dikenali. Contoh: 25k atau 25.000."),
      },
      {
        kind: "text",
        key: "description",
        prompt: "Untuk apa? Ketik keterangan, atau - untuk melewati.",
        validate: (v) => (v.length > 255 ? "Maksimal 255 karakter." : null),
      },
      {
        kind: "choice",
        key: "account",
        prompt: type === "expense" ? "Dari akun mana?" : "Masuk ke akun mana?",
        options: usable.map((a) => ({ label: `${a.name} · ${formatIdr(a.balance)}`, value: String(a.id) })),
        skipIf: () => usable.length === 1,
      },
      {
        kind: "choice",
        key: "category",
        prompt: "Kategorinya?",
        options: [...categoryOptions, { label: "Lewati", value: "none" }],
        skipIf: () => categoryOptions.length === 0,
      },
    ],
    finish: async (replyCtx, answers) => finishTransaction(replyCtx, type, usable, answers),
  };

  registerFlow(flow);
  await startFlow(ctx, flow, initial);
}

async function finishTransaction(
  ctx: Context,
  type: "expense" | "income",
  accounts: AccountItem[],
  answers: Answers,
): Promise<void> {
  const userId = ctx.from?.id;
  const amount = parseIdrAmount(answers.amount ?? "");
  if (userId === undefined || !amount) return void (await ctx.reply("Nominal tidak valid. Coba lagi."));

  const accountId = answers.account ?? String(accounts[0].id);
  const description = answers.description && answers.description !== "-" ? answers.description : undefined;
  const categoryId = answers.category && answers.category !== "none" ? Number(answers.category) : undefined;

  const res = await bridge<TransactionResult>(userId, "POST", "/finance/transactions", {
    type,
    amount,
    description,
    account_id: Number(accountId),
    finance_category_id: categoryId,
  });

  if (!res.ok) return void (await ctx.reply(res.message));

  const icon = type === "expense" ? "💸" : "💵";
  const label = type === "expense" ? "Pengeluaran" : "Pemasukan";
  const note = res.data.description ? ` · ${res.data.description}` : "";
  const balance =
    res.data.balance_after !== null && res.data.account_name
      ? `\nSaldo ${res.data.account_name}: ${formatIdr(res.data.balance_after)}`
      : "";

  await ctx.reply(`${icon} ${label} ${formatIdr(res.data.amount)}${note}${balance}`);
}

// /expense 25k makan siang: amount and description can be typed inline
function transactionFromArgs(ctx: Context, type: "expense" | "income"): Promise<void> {
  const args = (ctx.match ?? "").toString().trim();
  if (!args) return startTransaction(ctx, type);

  const [first, ...rest] = args.split(" ");
  const amount = parseIdrAmount(first);

  if (amount) {
    const description = rest.join(" ");
    return startTransaction(ctx, type, {
      amount: String(amount),
      ...(description ? { description } : {}),
    });
  }

  // First word is not an amount: treat the whole text as the description and ask for the amount
  return startTransaction(ctx, type, { description: args });
}

// Goal savings: choose a goal, then the amount. Does not change account balances.
async function startGoalWizard(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const goals = await bridge<GoalItem[]>(userId, "GET", "/finance/goals");
  if (!goals.ok) return void (await ctx.reply(goals.message));
  if (goals.data.length === 0) {
    return void (await ctx.reply("Belum ada goal. Tambahkan lewat dashboard Xibra."));
  }

  const flow: Flow = {
    id: `goal${userId}`,
    steps: [
      {
        kind: "choice",
        key: "goal",
        prompt: "Tabung untuk goal mana?",
        options: goals.data.map((g) => ({
          label: `${g.emoji ?? "🎯"} ${g.title} · ${formatIdr(g.current_amount)}`,
          value: String(g.id),
        })),
        skipIf: () => goals.data.length === 1,
      },
      {
        kind: "text",
        key: "amount",
        prompt: "Berapa yang ditabung? Contoh: 100k.",
        validate: (v) => (parseIdrAmount(v) ? null : "Nominal tidak dikenali. Contoh: 100k."),
      },
    ],
    finish: async (replyCtx, answers) => {
      const id = Number(answers.goal ?? goals.data[0].id);
      const amount = parseIdrAmount(answers.amount ?? "");
      if (!amount) return void (await replyCtx.reply("Nominal tidak valid."));

      const res = await bridge<GoalItem>(userId, "POST", `/finance/goals/${id}/contributions`, { amount });
      await replyCtx.reply(
        res.ok
          ? `🎯 ${res.data.title}: ${formatIdr(res.data.current_amount)} dari ${formatIdr(res.data.target_amount)}`
          : res.message,
      );
    },
  };

  registerFlow(flow);
  await startFlow(ctx, flow);
}

// Investment prices: pick an asset (skipped when there is only one), then type today's price per unit
async function startPriceWizard(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const accounts = await bridge<AccountItem[]>(userId, "GET", "/finance/accounts");
  if (!accounts.ok) return void (await ctx.reply(accounts.message));

  const assets = accounts.data.filter(isInvestment);
  if (assets.length === 0) {
    return void (await ctx.reply("Belum ada akun investasi. Tambahkan lewat /balance, lalu 🏦 Tambah akun."));
  }

  const flow: Flow = {
    id: `price${userId}`,
    steps: [
      {
        kind: "choice",
        key: "asset",
        prompt: "Perbarui harga aset mana?",
        options: assets.map((a) => ({
          label: `${a.name} · ${a.unit_price !== null ? formatIdr(a.unit_price) : "-"}/unit`,
          value: String(a.id),
        })),
        skipIf: () => assets.length === 1,
      },
      {
        kind: "text",
        key: "price",
        prompt: "Harga per unit sekarang? Contoh: 9500 atau 1,6jt.",
        validate: (v) => (parseIdrAmount(v) ? null : "Harga tidak dikenali. Contoh: 9500 atau 1,6jt."),
      },
    ],
    finish: async (replyCtx, answers) => {
      const id = Number(answers.asset ?? assets[0].id);
      const price = parseIdrAmount(answers.price ?? "");
      if (!price) return void (await replyCtx.reply("Harga tidak valid."));

      const res = await bridge<AccountItem>(userId, "POST", `/finance/accounts/${id}/price`, { unit_price: price });
      if (!res.ok) return void (await replyCtx.reply(res.message));

      const a = res.data;
      const detail = a.units !== null && a.unit_price !== null ? `${a.units} × ${formatIdr(a.unit_price)} = ` : "";
      await replyCtx.reply(`📈 ${a.name}: ${detail}${formatIdr(a.balance)}`);
    },
  };

  registerFlow(flow);
  await startFlow(ctx, flow);
}

export function registerFinance(bot: Bot): void {
  registerFlow(addAccountFlow);

  bot.command("balance", (ctx) => showBalance(ctx));
  bot.command(["expense", "spending"], (ctx) => transactionFromArgs(ctx, "expense"));
  bot.command("income", (ctx) => transactionFromArgs(ctx, "income"));

  bot.callbackQuery("fin:refresh", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showBalance(ctx);
  });
  bot.callbackQuery("fin:expense", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startTransaction(ctx, "expense");
  });
  bot.callbackQuery("fin:income", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startTransaction(ctx, "income");
  });
  bot.callbackQuery("fin:account", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startAddAccount(ctx);
  });
  bot.callbackQuery("fin:goal", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startGoalWizard(ctx);
  });
  bot.callbackQuery("fin:price", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return startPriceWizard(ctx);
  });
}
