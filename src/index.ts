import process from "process";
import { createBot } from "./bot.js";
import { config } from "./config.js";

const bot = createBot();

// Long polling untuk pengembangan lokal.
// Untuk VPS nanti, ganti dengan webhook di belakang Nginx.
const stop = () => {
  console.log("Stopping Xibra Bot...");
  bot.stop();
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

console.log(`Xibra API base: ${config.apiBase}`);
bot.start({
  onStart: (info) => console.log(`Xibra Bot running as @${info.username}`),
});
