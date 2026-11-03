// /news command and its buttons. Shows the latest headlines per category.
import { InlineKeyboard, type Bot, type Context } from "grammy";
import { ICON, captured, showOrEdit } from "../../core/ui.js";
import { ago } from "./format.js";
import { CATEGORIES, findCategory, type Category } from "./feeds.js";
import { loadCategory, type CategoryNews } from "./service.js";

const ITEMS_PER_VIEW = 5;

function renderNews(category: Category, news: CategoryNews): string {
  const lines = [`${ICON.news} Berita ${category.icon} ${category.label}`, `Diperbarui ${ago(news.fetchedAt)}`, ""];

  if (news.items.length === 0) {
    lines.push("Berita belum bisa dimuat. Coba lagi beberapa menit lagi.");
  } else {
    news.items.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title}`, `   ${item.source} · ${ago(item.publishedAt)}`, `   ${item.link}`, "");
    });
  }

  if (news.stale) lines.push("⚠️ Semua sumber gagal. Menampilkan data yang tersimpan sebelumnya.");
  if (news.failed.length > 0) lines.push(`⚠️ Gagal memuat: ${news.failed.join("; ")}`);

  return lines.join("\n").trim();
}

function categoryKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  CATEGORIES.forEach((c, i) => {
    keyboard.text(`${c.icon} ${c.label}`, `news:cat:${c.id}`);
    if (i % 2 === 1) keyboard.row();
  });
  return keyboard;
}

async function showCategory(ctx: Context, category: Category): Promise<void> {
  await ctx.replyWithChatAction("typing").catch(() => undefined);
  const news = await loadCategory(category, ITEMS_PER_VIEW);

  const keyboard = new InlineKeyboard()
    .text(`${ICON.refresh} Muat ulang`, `news:cat:${category.id}`)
    .text("📂 Kategori lain", "news:pick");

  await showOrEdit(ctx, renderNews(category, news), keyboard);
}

export function registerNews(bot: Bot): void {
  bot.command("news", async (ctx) => {
    const arg = (ctx.match ?? "").toString().trim();
    if (!arg) {
      await ctx.reply(`${ICON.news} Pilih kategori berita:`, { reply_markup: categoryKeyboard() });
      return;
    }

    const category = findCategory(arg);
    if (!category) {
      await ctx.reply(`Kategori tidak dikenal. Pilihan: ${CATEGORIES.map((c) => c.id).join(", ")}.`);
      return;
    }
    await showCategory(ctx, category);
  });

  bot.callbackQuery("news:pick", (ctx) =>
    showOrEdit(ctx, `${ICON.news} Pilih kategori berita:`, categoryKeyboard()),
  );

  bot.callbackQuery(/^news:cat:([a-z]+)$/, async (ctx) => {
    const category = findCategory(captured(ctx));
    if (!category) return ctx.answerCallbackQuery({ text: "Kategori tidak dikenal." });
    await ctx.answerCallbackQuery().catch(() => undefined);
    await showCategory(ctx, category);
  });
}
