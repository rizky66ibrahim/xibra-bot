// /news: shows the latest headlines right away, with category buttons underneath.
import { InlineKeyboard, type Bot, type Context } from "grammy";
import { ICON, captured, showOrEdit } from "../../core/ui.js";
import { CATEGORIES, findCategory, type Category } from "./feeds.js";
import { renderNewsHtml } from "./render.js";
import { loadCategory } from "./service.js";

const ITEMS_PER_VIEW = 10;

function keyboardFor(active: Category): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  CATEGORIES.forEach((c, i) => {
    const mark = c.id === active.id ? "✓ " : "";
    keyboard.text(`${mark}${c.icon} ${c.label}`, `news:cat:${c.id}`);
    if (i % 2 === 1) keyboard.row();
  });

  keyboard.row().text(`${ICON.refresh} Muat ulang`, `news:cat:${active.id}`).text("🏠 Menu Utama", "home:refresh");
  return keyboard;
}

async function showCategory(ctx: Context, category: Category): Promise<void> {
  await ctx.replyWithChatAction("typing").catch(() => undefined);
  const news = await loadCategory(category, ITEMS_PER_VIEW);
  await showOrEdit(ctx, renderNewsHtml(category, news), keyboardFor(category), { html: true });
}

export function registerNews(bot: Bot): void {
  // /news shows Indonesian news immediately. /news teknologi jumps to a category.
  bot.command("news", async (ctx) => {
    const arg = (ctx.match ?? "").toString().trim();
    const category = arg ? findCategory(arg) : CATEGORIES[0];

    if (!category) {
      await ctx.reply(`Kategori tidak dikenal. Pilihan: ${CATEGORIES.map((c) => c.id).join(", ")}.`);
      return;
    }
    await showCategory(ctx, category);
  });

  // Used by the home screen button
  bot.callbackQuery("news:pick", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showCategory(ctx, CATEGORIES[0]);
  });

  bot.callbackQuery(/^news:cat:([a-z]+)$/, async (ctx) => {
    const category = findCategory(captured(ctx));
    if (!category) return ctx.answerCallbackQuery({ text: "Kategori tidak dikenal." });
    await ctx.answerCallbackQuery().catch(() => undefined);
    return showCategory(ctx, category);
  });
}
