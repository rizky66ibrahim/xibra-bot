import { Bot, type Context } from "grammy";
import { config } from "./config.js";
import { pairTelegramAccount } from "./api.js";
import { UNLINKED_MESSAGE } from "./bridge.js";
import { COMING_SOON, HELP_TEXT, showMenu } from "./handlers/menu.js";
import { showStart } from "./handlers/start.js";
import { newsFlow, refreshNews, startNewsWizard } from "./handlers/news.js";
import {
  addTaskFlow,
  completeTask,
  showTodo,
  startAddTask,
} from "./handlers/tasks.js";
import {
  reminderFlow,
  showDay,
  showReminders,
  startReminderWizard,
} from "./handlers/planner.js";
import {
  blokMalamFlow,
  catatShiftFlow,
  cancelBlock,
  saveBlock,
  showShifts,
  standbyFlow,
  startStandby,
  startWithDate,
} from "./handlers/shifts.js";
import {
  registerFlow,
  handleCallback,
  handleText,
  startFlow,
} from "./wizard/engine.js";
import { clearSession } from "./wizard/state.js";

// Format kode dari API: XIBRA-XXXX-XXXX (huruf besar dan angka)
const CODE_PATTERN = /^XIBRA-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function argOf(ctx: Context): string | undefined {
  return (ctx.match ?? "").toString().trim() || undefined;
}

// Aksi tombol menu. Kunci adalah callback_data.
const MENU_ACTIONS: Record<string, (ctx: Context) => Promise<unknown>> = {
  "m:news": (ctx) => startNewsWizard(ctx),
  "m:menu": (ctx) => showMenu(ctx),
  "m:help": (ctx) => ctx.reply(HELP_TEXT),
  "m:todo": (ctx) => showTodo(ctx),
  "m:jadwal": (ctx) => showDay(ctx),
  "m:pengingat": (ctx) => showReminders(ctx),
  "m:shift": (ctx) => showShifts(ctx),
  "m:addtodo": (ctx) => startAddTask(ctx),
  "m:ingatkan": (ctx) => startReminderWizard(ctx),
};

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  registerFlow(newsFlow);
  registerFlow(addTaskFlow);
  registerFlow(reminderFlow);
  registerFlow(blokMalamFlow);
  registerFlow(catatShiftFlow);
  registerFlow(standbyFlow);

  bot.command("start", showStart);
  bot.command("menu", (ctx) => showMenu(ctx));
  bot.command("help", (ctx) => ctx.reply(HELP_TEXT));

  bot.command("berita", (ctx) => startNewsWizard(ctx, argOf(ctx)));

  bot.command("todo", (ctx) => showTodo(ctx));
  bot.command("addtodo", (ctx) => startAddTask(ctx, argOf(ctx)));
  bot.command("done", (ctx) => {
    const id = Number(argOf(ctx));
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.reply("Format: /done <id>. Lihat id tugas di /todo.");
    }
    return completeTask(ctx, id);
  });

  bot.command("jadwal", (ctx) => showDay(ctx, argOf(ctx)));
  bot.command("pengingat", (ctx) => showReminders(ctx));
  bot.command("ingatkan", (ctx) => startFlow(ctx, reminderFlow));

  bot.command("shift", (ctx) => showShifts(ctx, argOf(ctx)));
  bot.command("blokmalam", (ctx) =>
    startWithDate(ctx, blokMalamFlow, argOf(ctx)),
  );
  bot.command("catatshift", (ctx) =>
    startWithDate(ctx, catatShiftFlow, argOf(ctx)),
  );
  bot.command("jumat", (ctx) => startStandby(ctx, argOf(ctx)));

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

  // Tombol wizard (w:...), konfirmasi blok malam (sb:...), muat ulang berita (nr:...), menu (m:...)
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (await handleCallback(ctx)) return;

    if (data.startsWith("sb:")) {
      const [, action, value] = data.split(":");
      await ctx.answerCallbackQuery().catch(() => undefined);
      return action === "save" && value
        ? saveBlock(ctx, value)
        : cancelBlock(ctx);
    }

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
