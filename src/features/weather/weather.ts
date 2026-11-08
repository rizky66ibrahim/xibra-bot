// /weather: current weather with today's range and rain chance.
import { InlineKeyboard, type Bot, type Context } from "grammy";
import { config } from "../../core/config.js";
import { showOrEdit, withFooter } from "../../core/ui.js";
import { formatWeatherDetail } from "./render.js";
import { getWeather } from "./service.js";

export async function showWeather(ctx: Context): Promise<void> {
  const weather = await getWeather();
  const text = weather
    ? formatWeatherDetail(config.weather.label, weather)
    : "Cuaca belum bisa dimuat. Coba lagi beberapa saat lagi.";

  await showOrEdit(ctx, text, withFooter(new InlineKeyboard(), "weather:show"));
}

export function registerWeather(bot: Bot): void {
  bot.command("weather", (ctx) => showWeather(ctx));

  bot.callbackQuery("weather:show", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showWeather(ctx);
  });
}
