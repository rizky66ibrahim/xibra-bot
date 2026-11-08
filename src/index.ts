import { createBot } from "./bot.js";
import { config } from "./core/config.js";
import { acquireSingleInstance } from "./core/singleton.js";
import { startCheckinScheduler } from "./features/checkin/checkin.js";
import { BOT_COMMANDS } from "./features/help/commands.js";
import { startReminderNotifier } from "./features/reminders/notifier.js";

// Refuse to start if another bot process is already polling this token
acquireSingleInstance();

const bot = createBot();

// The "/" menu in Telegram. The list lives in features/help/commands.ts.
await bot.api.setMyCommands(BOT_COMMANDS);

// Long polling. Only one process may poll a token at a time.
const stop = () => {
  console.log("Stopping Xibra Bot...");
  bot.stop();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

console.log(`Xibra API base: ${config.apiBase}`);
startReminderNotifier(bot);
startCheckinScheduler(bot);
bot.start({
  onStart: (info) => console.log(`Xibra Bot running as @${info.username}`),
});
