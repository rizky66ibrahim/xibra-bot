// Builds the bot: registers every feature, then the shared wizard and text handlers.
import { Bot } from "grammy";
import { config } from "./core/config.js";
import { handleCallback, handleText } from "./core/wizard/engine.js";
import { clearSession } from "./core/wizard/state.js";
import { registerHome } from "./features/home/home.js";
import { registerTasks } from "./features/tasks/tasks.js";
import { registerSchedule } from "./features/schedule/schedule.js";
import { registerWeek } from "./features/week/week.js";
import { registerReminders } from "./features/reminders/reminders.js";
import { registerShifts } from "./features/shifts/shifts.js";
import { registerNews } from "./features/news/index.js";
import { registerWeather } from "./features/weather/index.js";
import { registerAdd } from "./features/add/add.js";
import { registerFinance } from "./features/finance/finance.js";
import { registerPairing } from "./features/pairing/pairing.js";
import { registerHelp } from "./features/help/help.js";

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // Each feature registers its own commands, buttons, and wizard flows
  registerHome(bot);
  registerTasks(bot);
  registerSchedule(bot);
  registerWeek(bot);
  registerReminders(bot);
  registerShifts(bot);
  registerNews(bot);
  registerWeather(bot);
  registerAdd(bot);
  registerFinance(bot);
  registerPairing(bot);
  registerHelp(bot);

  bot.command("cancel", async (ctx) => {
    if (ctx.from) clearSession(ctx.from.id);
    await ctx.reply("Dibatalkan.");
  });

  // Wizard buttons (wz:...)
  bot.callbackQuery(/^wz:/, async (ctx) => {
    const handled = await handleCallback(ctx);
    if (!handled) await ctx.answerCallbackQuery().catch(() => undefined);
  });

  // Typed replies: consumed by a running wizard, otherwise point the user to /help
  bot.on("message:text", async (ctx) => {
    if (await handleText(ctx)) return;
    await ctx.reply("Ketik /help untuk daftar perintah, atau /start untuk ringkasan hari ini.");
  });

  bot.catch((err) => {
    console.error("Bot error:", err.error instanceof Error ? err.error.message : err.error);
  });

  return bot;
}
