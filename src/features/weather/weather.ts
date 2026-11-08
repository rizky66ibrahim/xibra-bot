import { InlineKeyboard, Keyboard, type Bot, type Context } from "grammy";

import { showOrEdit, withFooter } from "../../core/ui.js";
import { getUserLocation, saveUserLocation } from "./location.js";
import { formatWeatherDetail } from "./render.js";
import { getWeather } from "./service.js";

const LOCATION_KEYBOARD = new Keyboard()
  .requestLocation("📍 Share My Location")
  .resized()
  .oneTime();

async function requestLocation(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== "private") {
    await ctx.reply(
      "To protect your privacy, please open a private chat with Xibra Bot to share your location.",
    );
    return;
  }

  await ctx.reply(
    "📍 **Share your location**\n\n" +
      "I need your location to provide relevant weather information.\n\n" +
      "Tap the button below to share your location.",
    {
      parse_mode: "Markdown",
      reply_markup: LOCATION_KEYBOARD,
    },
  );
}

export async function showWeather(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;

  if (userId === undefined) return;

  const location = getUserLocation(userId);

  if (!location) {
    await requestLocation(ctx);
    return;
  }

  const weather = await getWeather(location.latitude, location.longitude);

  const text = weather
    ? formatWeatherDetail("Your Location", weather)
    : "Unable to load weather information. Please try again later.";
  await showOrEdit(ctx, text, withFooter(new InlineKeyboard(), "weather:show"));
}

export function registerWeather(bot: Bot): void {
  bot.command("weather", (ctx) => showWeather(ctx));

  bot.command("location", (ctx) => requestLocation(ctx));

  bot.on("message:location", async (ctx) => {
    if (ctx.chat.type !== "private" || !ctx.from) {
      await ctx.reply("Please share location via private chat with Xibra Bot.");
      return;
    }

    const { latitude, longitude } = ctx.message.location;

    try {
      saveUserLocation(ctx.from.id, latitude, longitude);
    } catch {
      await ctx.reply("Invalid location. Please try again.");
      return;
    }

    await ctx.reply("✅ Location updated successfully.", {
      reply_markup: { remove_keyboard: true },
    });
    await showWeather(ctx);
  });

  bot.callbackQuery("weather:show", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showWeather(ctx);
  });
}
