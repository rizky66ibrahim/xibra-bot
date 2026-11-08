import { InlineKeyboard, Keyboard, type Bot, type Context } from "grammy";

import { showOrEdit } from "../../core/ui.js";
import { formatWeatherDetail } from "./render.js";
import { getWeather } from "./service.js";
import {
  getUserLocation,
  saveUserLocation,
  resolveLocationName,
  updateUserLocationName,
  getLocationLabel,
} from "./location.js";

const LOCATION_KEYBOARD = new Keyboard()
  .requestLocation("📍 Bagikan Lokasi Saya")
  .resized()
  .oneTime();

async function requestLocation(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== "private") {
    await ctx.reply(
      "Please open a private chat with Xibra Bot to update your location.",
    );
    return;
  }

  await ctx.reply(
    "📍 Share your latest location to update weather information.",
    { reply_markup: LOCATION_KEYBOARD },
  );
}

export async function showWeather(
  ctx: Context,
  forceRefresh = false,
): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) return;

  const location = getUserLocation(userId);

  if (!location) {
    await requestLocation(ctx);
    return;
  }

  const weather = await getWeather(
    location.latitude,
    location.longitude,
    forceRefresh,
  );

  if (!weather) {
    await ctx.reply(
      "The weather could not be loaded. Please try again in a moment.",
    );
    return;
  }

  const keyboard = new InlineKeyboard()
    .text("↻ Muat Ulang", "weather:refresh")
    .text("📍 Update Location", "weather:location")
    .row()
    .text("🏠 Main Menu", "home:refresh");
  await showOrEdit(
    ctx,
    formatWeatherDetail(getLocationLabel(userId), weather),
    keyboard,
  );
}

export function registerWeather(bot: Bot): void {
  bot.command("weather", (ctx) => showWeather(ctx));

  bot.command("location", (ctx) => requestLocation(ctx));

  bot.on("message:location", async (ctx) => {
    if (ctx.chat.type !== "private" || !ctx.from) {
      await ctx.reply(
        "Please share your location via Xibra Bot's private chat.",
      );
      return;
    }

    const { latitude, longitude } = ctx.message.location;

    try {
      saveUserLocation(ctx.from.id, latitude, longitude);
    } catch {
      await ctx.reply("Invalid location. Please try again.");
      return;
    }

    const details = await resolveLocationName(latitude, longitude);

    if (details) {
      updateUserLocationName(ctx.from.id, latitude, longitude, details);
    }

    await ctx.reply("✅ Location successfully updated.", {
      reply_markup: { remove_keyboard: true },
    });
    await showWeather(ctx);
  });

  bot.callbackQuery("weather:refresh", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Updating the weather..." });
    await showWeather(ctx, true);
  });

  bot.callbackQuery("weather:location", async (ctx) => {
    await ctx.answerCallbackQuery();
    await requestLocation(ctx);
  });

  bot.callbackQuery("weather:show", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showWeather(ctx);
  });
}
