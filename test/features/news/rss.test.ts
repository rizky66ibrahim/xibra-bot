import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeItems, parseFeed } from '../../../src/features/news/rss.js'

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Harga emas &amp; saham naik]]></title>
    <link>https://example.com/a?utm=1</link>
    <pubDate>Mon, 02 Nov 2026 10:00:00 +0700</pubDate>
  </item>
  <item>
    <title>Tanpa tanggal</title>
    <link>https://example.com/b</link>
  </item>
  <item>
    <title>Bukan link</title>
    <link>tidak-valid</link>
  </item>
</channel></rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Berita Atom</title>
    <link rel="alternate" href="https://example.com/atom-1"/>
    <published>2026-11-02T03:00:00Z</published>
  </entry>
</feed>`

test('parses RSS items, decodes entities, skips invalid links', () => {
  const items = parseFeed(RSS, 'Contoh')
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'Harga emas & saham naik')
  assert.equal(items[0].source, 'Contoh')
  assert.ok(items[0].publishedAt > 0)
  assert.equal(items[1].publishedAt, 0)
})

test('parses Atom entries', () => {
  const items = parseFeed(ATOM, 'Atom')
  assert.equal(items.length, 1)
  assert.equal(items[0].link, 'https://example.com/atom-1')
  assert.ok(items[0].publishedAt > 0)
})

test('mergeItems removes duplicates by link and sorts newest first', () => {
  const a = parseFeed(RSS, 'A')
  const b = parseFeed(ATOM, 'B')
  const merged = mergeItems([a, b, a])
  assert.equal(merged.length, 3)
  for (let i = 1; i < merged.length; i++) {
    assert.ok(merged[i - 1].publishedAt >= merged[i].publishedAt)
  }
})
