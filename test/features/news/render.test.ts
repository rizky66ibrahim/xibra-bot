import { test } from "node:test";
import assert from "node:assert/strict";
import type { Category } from "../../../src/features/news/feeds.js";
import {
  escapeHtml,
  renderNewsHtml,
} from "../../../src/features/news/render.js";
import type { CategoryNews } from "../../../src/features/news/service.js";

const category: Category = {
  id: "indonesia",
  label: "Indonesia",
  icon: "🏛️",
  aliases: [],
  feeds: [],
};
const NOW = Date.parse("2026-11-04T06:00:00Z");

function news(overrides: Partial<CategoryNews> = {}): CategoryNews {
  return { items: [], failed: [], stale: false, fetchedAt: NOW, ...overrides };
}

test("escapeHtml escapes the characters Telegram HTML cares about", () => {
  assert.equal(
    escapeHtml(`Tom & "Jerry" <b>`),
    "Tom &amp; &quot;Jerry&quot; &lt;b&gt;",
  );
});

test("each headline is a clickable link followed by source and age", () => {
  const text = renderNewsHtml(
    category,
    news({
      items: [
        {
          title: "Hujan lebat mengguyur Palembang",
          link: "https://www.antaranews.com/berita/1/hujan",
          source: "Antara",
          publishedAt: NOW - 12 * 60_000,
        },
      ],
    }),
    NOW,
  );

  assert.match(
    text,
    /1\. <a href="https:\/\/www\.antaranews\.com\/berita\/1\/hujan">Hujan lebat mengguyur Palembang<\/a> — Antara · 12 menit lalu/,
  );
  assert.match(text, /<b>🏛️ Indonesia<\/b>/);
});

test("titles and links with special characters cannot break the HTML", () => {
  const text = renderNewsHtml(
    category,
    news({
      items: [
        {
          title: `A & B <script>`,
          link: "https://x.id/a?x=1&y=2",
          source: "S",
          publishedAt: NOW,
        },
      ],
    }),
    NOW,
  );

  assert.match(text, /A &amp; B &lt;script&gt;/);
  assert.match(text, /href="https:\/\/x\.id\/a\?x=1&amp;y=2"/);
});

test("an empty list says so, and failed sources are named", () => {
  const text = renderNewsHtml(
    category,
    news({ failed: ["CNN Indonesia (HTTP 500)"] }),
    NOW,
  );
  assert.match(text, /Berita belum bisa dimuat/);
  assert.match(text, /Gagal memuat: CNN Indonesia \(HTTP 500\)/);
});
