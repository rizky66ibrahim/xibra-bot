import { Bot, type Context } from "grammy";
import { config } from "./config.js";
import { pairTelegramAccount } from "./api.js";
import { bridge, UNLINKED_MESSAGE } from "./bridge.js";
import {
  COMING_SOON,
  HELP_TEXT,
  PAIR_HINT,
  showMenu,
} from "./handlers/menu.js";
import { newsFlow, refreshNews, startNewsWizard } from "./handlers/news.js";
import {
  addTaskFlow,
  completeTask,
  showTodo,
  startAddTask,
} from "./handlers/tasks.js";
import {
  reminderFlow,
  showReminders,
  showSchedules,
  showShifts,
  startReminderWizard,
} from "./handlers/planner.js";
import {
  registerFlow,
  handleCallback,
  handleText,
  startFlow,
} from "./wizard/engine.js";
import { clearSession } from "./wizard/state.js";

// Format kode dari API: XIBRA-XXXX-XXXX (huruf besar dan angka)
const CODE_PATTERN = /^XIBRA-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

interface MeResponse {
  user: { id: number; name: string; username: string };
}

function argOf(ctx: Context): string | undefined {
  return (ctx.match ?? "").toString().trim() || undefined;
}

async function showStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const res = await bridge<MeResponse>(userId, "GET", "/me");

  if (!res.ok) {
    if (res.reason === "unlinked") {
      await ctx.reply(`Halo, saya Xibra Bot.\n\n${PAIR_HINT}`);
      return;
    }
    await ctx.reply(res.message);
    return;
  }

  await ctx.reply(`Halo, ${res.data.user.name}! Akun Anda sudah terhubung.`);
  await showMenu(ctx);
}

// Aksi tombol menu. Kunci adalah callback_data.
const MENU_ACTIONS: Record<string, (ctx: Context) => Promise<unknown>> = {
  "m:news": (ctx) => startNewsWizard(ctx),
  "m:menu": (ctx) => showMenu(ctx),
  "m:help": (ctx) => ctx.reply(HELP_TEXT),
  "m:todo": (ctx) => showTodo(ctx),
  "m:jadwal": (ctx) => showSchedules(ctx),
  "m:pengingat": (ctx) => showReminders(ctx),
  "m:shift": (ctx) => showShifts(ctx),
  "m:addtask": (ctx) => startAddTask(ctx),
  "m:ingatkan": (ctx) => startReminderWizard(ctx),
};

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  registerFlow(newsFlow);
  registerFlow(addTaskFlow);
  registerFlow(reminderFlow);

  bot.command("start", showStart);
  bot.command("menu", (ctx) => showMenu(ctx));
  bot.command("help", (ctx) => ctx.reply(HELP_TEXT));

  bot.command("berita", (ctx) => startNewsWizard(ctx, argOf(ctx)));

  bot.command("todo", (ctx) => showTodo(ctx));
  bot.command("addtask", (ctx) => startAddTask(ctx, argOf(ctx)));
  bot.command("done", (ctx) => {
    const id = Number(argOf(ctx));
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.reply("Format: /done <id>. Lihat id tugas di /todo.");
    }
    return completeTask(ctx, id);
  });

  bot.command("jadwal", (ctx) => showSchedules(ctx, argOf(ctx)));
  bot.command("pengingat", (ctx) => showReminders(ctx));
  bot.command("ingatkan", (ctx) => startFlow(ctx, reminderFlow));
  bot.command("shift", (ctx) => showShifts(ctx, argOf(ctx)));

  bot.command("batal", async (ctx) => {
    if (ctx.from) clearSession(ctx.from.id);
    await ctx.reply("Proses dibatalkan.");
  });

  bot.command("pair", async (ctx) => {
    const code = (argOf(ctx) ?? "").toUpperCase();

    if (!CODE_PATTERN.test(code)) {
      return ctx.reply("Format kode salah. Contoh: /pair XIBRA-AB12-CD34");
    }

    const from = ctx.from;
    if (!from) {
      return ctx.reply("Akun Telegram Anda tidak terbaca. Coba lagi.");
    }

    // Kode tidak pernah ditulis ke log
    const result = await pairTelegramAccount({
      code,
      telegramUserId: from.id,
      telegramUsername: from.username ?? "",
    });

    return ctx.reply(result.message);
  });

  // Tombol wizard (w:...), muat ulang berita (nr:...), menu (m:...)
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (await handleCallback(ctx)) return;

    if (data.startsWith("nr:")) {
      const [, categoryId, count] = data.split(":");
      return refreshNews(ctx, categoryId, Number(count));
    }

    await ctx.answerCallbackQuery().catch(() => undefined);

    if (data.startsWith("m:soon:")) {
      const key = data.slice("m:soon:".length);
      return ctx.reply(COMING_SOON[key] ?? "Fitur ini belum tersedia.");
    }

    const action = MENU_ACTIONS[data];
    if (action) return action(ctx);
  });

  // Teks biasa: dipakai langkah wizard bertipe teks. Di luar wizard, arahkan ke menu.
  bot.on("message:text", async (ctx) => {
    if (await handleText(ctx)) return;
    await ctx.reply(
      "Ketik /menu untuk melihat fitur, atau /help untuk daftar perintah.",
    );
  });

  bot.catch((err) => {
    console.error(
      "Bot error:",
      err.error instanceof Error ? err.error.message : err.error,
    );
  });

  return bot;
}

export { UNLINKED_MESSAGE };
