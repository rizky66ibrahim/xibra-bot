// Finance: balance overview, expense and income recording, accounts, and goal savings.
import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { bridge } from "../../core/bridge.js";
import { formatIdr, parseIdrAmount } from "../../core/money.js";
import { ICON, showOrEdit } from "../../core/ui.js";
import { registerFlow, startFlow } from "../../core/wizard/engine.js";
import type { Answers, Flow } from "../../core/wizard/types.js";

interface AccountItem {
  id: number;
  name: string;
  type: string;
  provider: string | null;
  balance: number;
  currency: string;
}

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

const ACCOUNT_TYPE_OPTIONS = [
  { label: "💵 Tunai", value: "cash" },
  { label: "🏦 Bank", value: "bank" },
  { label: "📱 E-wallet", value: "ewallet" },
];

// Balance overview with buttons for the common actions
export async function showBalance(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const [accounts, summary, budgets] = await Promise.all([
    bridge<AccountItem[]>(userId, "GET", "/finance/accounts"),
    bridge<SummaryItem>(userId, "GET", "/finance/summary"),
    bridge<BudgetItem[]>(userId, "GET", "/finance/budgets"),
  ]);

  if (!accounts.ok) return void (await showOrEdit(ctx, accounts.message));

  const lines: string[] = [`${ICON.expense} Keuangan`, ""];

  if (accounts.data.length === 0) {
    lines.push("Belum ada akun. Tekan 🏦 Tambah akun untuk mulai.");
  } else {
    lines.push("Saldo");
    for (const a of accounts.data) lines.push(`• ${a.name}  ${formatIdr(a.balance)}`);
    const total = accounts.data.reduce((sum, a) => sum + a.balance, 0);
    lines.push(`Total  ${formatIdr(total)}`);
  }

  if (summary.ok) {
    lines.push("", `Bulan ini: masuk ${formatIdr(summary.data.income)} · keluar ${formatIdr(summary.data.expense)}`);
  }

  if (budgets.ok && budgets.data.length > 0) {
    lines.push("", "Budget");
    for (const b of budgets.data) {
      lines.push(`• ${b.name}: ${formatIdr(b.spent)} dari ${formatIdr(b.amount)}`);
    }
  }

  const keyboard = new InlineKeyboard()
    .text(`➖ Pengeluaran`, "fin:expense")
    .text(`➕ Pemasukan`, "fin:income")
    .row()
    .text("🏦 Tambah akun", "fin:account")
    .text("🎯 Tabung ke goal", "fin:goal")
    .row()
    .text(`${ICON.refresh} Muat ulang`, "fin:refresh");

  await showOrEdit(ctx, lines.join("\n"), keyboard);
}

// Builds a transaction wizard for the user's current accounts and categories
async function startTransaction(ctx: Context, type: "expense" | "income", initial: Answers = {}): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const [accounts, categories] = await Promise.all([
    bridge<AccountItem[]>(userId, "GET", "/finance/accounts"),
    bridge<CategoryItem[]>(userId, "GET", `/finance/categories?type=${type}`),
  ]);

  if (!accounts.ok) return void (await ctx.reply(accounts.message));
  if (accounts.data.length === 0) {
    return void (await ctx.reply("Belum ada akun. Buka /balance, lalu tekan 🏦 Tambah akun dulu."));
  }

  const categoryOptions = categories.ok
    ? categories.data.map((c) => ({ label: c.name, value: String(c.id) }))
    : [];

  // Flow ids are per user, because the account and category choices differ from user to user
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
        prompt: "Dari akun mana?",
        options: accounts.data.map((a) => ({ label: `${a.name} · ${formatIdr(a.balance)}`, value: String(a.id) })),
        skipIf: () => accounts.data.length === 1,
      },
      {
        kind: "choice",
        key: "category",
        prompt: "Kategorinya?",
        options: [...categoryOptions, { label: "Lewati", value: "none" }],
        skipIf: () => categoryOptions.length === 0,
      },
    ],
    finish: async (replyCtx, answers) => finishTransaction(replyCtx, type, accounts.data, answers),
  };

  registerFlow(flow);
  await startFlow(ctx, flow, initial);
}

async function finishTransaction(ctx: Context, type: "expense" | "income", accounts: AccountItem[], answers: Answers): Promise<void> {
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

  const icon = type === "expense" ? "➖" : "➕";
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

const addAccountFlow: Flow = {
  id: "addaccount",
  steps: [
    {
      kind: "text",
      key: "name",
      prompt: "Nama akunnya? Contoh: BCA, GoPay, Dompet.",
      validate: (v) => (v.length === 0 || v.length > 255 ? "Nama wajib diisi, maksimal 255 karakter." : null),
    },
    { kind: "choice", key: "type", prompt: "Jenis akunnya?", options: ACCOUNT_TYPE_OPTIONS },
    {
      kind: "text",
      key: "balance",
      prompt: "Saldo awal? Contoh: 250k. Ketik 0 jika belum tahu.",
      validate: (v) => (v === "0" || parseIdrAmount(v) ? null : "Nominal tidak dikenali. Contoh: 250k atau 0."),
    },
  ],
  finish: async (ctx, answers) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const balance = answers.balance === "0" ? 0 : parseIdrAmount(answers.balance ?? "") ?? 0;
    const res = await bridge<AccountItem>(userId, "POST", "/finance/accounts", {
      name: answers.name,
      type: answers.type,
      balance,
    });

    await ctx.reply(
      res.ok ? `🏦 Akun dibuat: ${res.data.name}, saldo ${formatIdr(res.data.balance)}` : res.message,
    );
  },
};

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
      },
      {
        kind: "text",
        key: "amount",
        prompt: "Berapa yang ditabung? Contoh: 100k.",
        validate: (v) => (parseIdrAmount(v) ? null : "Nominal tidak dikenali. Contoh: 100k."),
      },
    ],
    finish: async (replyCtx, answers) => {
      const id = Number(answers.goal);
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

export function registerFinance(bot: Bot): void {
  registerFlow(addAccountFlow);

  bot.command("balance", (ctx) => showBalance(ctx));
  bot.command(["expense", "spending"], (ctx) => transactionFromArgs(ctx, "expense"));
  bot.command("income", (ctx) => transactionFromArgs(ctx, "income"));

  bot.callbackQuery("fin:refresh", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showBalance(ctx);
  });
  bot.callbackQuery("fin:expense", (ctx) => startTransaction(ctx, "expense"));
  bot.callbackQuery("fin:income", (ctx) => startTransaction(ctx, "income"));
  bot.callbackQuery("fin:account", (ctx) => startFlow(ctx, addAccountFlow));
  bot.callbackQuery("fin:goal", (ctx) => startGoalWizard(ctx));
}

