// Pure rendering of a news list as Telegram HTML. No Telegram calls, so it is easy to test.
import type { Category } from "./feeds.js";
import { ago } from "./format.js";
import type { CategoryNews } from "./service.js";

// Telegram HTML supports only &amp; &lt; &gt; &quot; as entities
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// One line per item: "1. <a href="...">Title</a> — Source · 13 menit lalu"
export function renderNewsHtml(
  category: Category,
  news: CategoryNews,
  now = Date.now(),
): string {
  const lines = [
    `<b>${escapeHtml(category.icon)} ${escapeHtml(category.label)}</b>`,
    `Diperbarui ${ago(news.fetchedAt, now)}`,
    "",
  ];
  if (news.items.length === 0) {
    lines.push("Berita belum bisa dimuat. Coba lagi beberapa menit lagi.");
  } else {
    news.items.forEach((item, i) => {
      lines.push(
        `${i + 1}. <a href="${escapeHtml(item.link)}">${escapeHtml(item.title)}</a> — ${escapeHtml(item.source)} · ${ago(item.publishedAt, now)}`,
      );
    });
  }

  if (news.stale)
    lines.push(
      "",
      "⚠️ Semua sumber gagal. Menampilkan data yang tersimpan sebelumnya.",
    );
  if (news.failed.length > 0)
    lines.push("", `⚠️ Gagal memuat: ${escapeHtml(news.failed.join("; "))}`);

  return lines.join("\n");
}
