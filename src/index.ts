import { createBot } from "./bot.js";
import { config } from "./core/config.js";
import { startReminderNotifier } from "./features/reminders/notifier.js";

const bot = createBot();

// Telegram shows these in the "/" menu. Keep the list short.
await bot.api.setMyCommands([
  { command: "start", description: "Today's overview" },
  { command: "task", description: "Open tasks" },
  { command: "schedule", description: "Today's schedule" },
  { command: "week", description: "Next 7 days" },
  { command: "reminder", description: "Upcoming reminders" },
  { command: "shift", description: "Shifts, night blocks, Friday standby" },
  { command: "news", description: "Latest news" },
  { command: "add", description: "Add task, schedule, or reminder" },
  { command: "pair", description: "Link your Xibra account" },
  { command: "cancel", description: "Cancel the current step" },
  { command: "help", description: "List of commands" },
]);

// Long polling for local development. Switch to a webhook behind Nginx on the VPS.
const stop = () => {
  console.log("Stopping Xibra Bot...");
  bot.stop();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

console.log(`Xibra API base: ${config.apiBase}`);
startReminderNotifier(bot);
bot.start({
  onStart: (info) => console.log(`Xibra Bot running as @${info.username}`),
});
