import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  // Token from @BotFather. Never commit it.
  botToken: required("BOT_TOKEN"),

  // Xibra API base URL without a trailing slash
  apiBase: (process.env.XIBRA_API_BASE || "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  ),

  // Shared secret sent in the X-Telegram-Bot-Secret header
  botSecret: required("TELEGRAM_BOT_SECRET"),
};
