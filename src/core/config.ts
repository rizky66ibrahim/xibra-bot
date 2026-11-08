import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Reads a number from the environment, or falls back when it is missing or not a number
function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return process.env[name] && Number.isFinite(value) ? value : fallback;
}

export const config = {
  // Token from @BotFather. Never commit it.
  botToken: required("BOT_TOKEN"),
  // Xibra API base URL without a trailing slash
  apiBase: (process.env.XIBRA_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, ""),
  // Shared secret sent in the X-Telegram-Bot-Secret header
  botSecret: required("TELEGRAM_BOT_SECRET"),
  // Location of the weather line on the home screen. Defaults to Bekasi.
  weather: {
    label: process.env.WEATHER_LABEL || "Bekasi, Jawa Barat",
    latitude: numberEnv("WEATHER_LAT", -6.2349),
    longitude: numberEnv("WEATHER_LON", 106.9896),
  },
};
