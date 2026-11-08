// Small RSS 2.0 and Atom parser with no extra dependencies.

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  // Publish time in epoch milliseconds. 0 when missing or unreadable.
  publishedAt: number;
}

const MAX_ITEMS_PER_FEED = 20;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000
          ? String.fromCodePoint(code)
          : "";
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    },
  );
}

// Unwrap CDATA, strip HTML tags, decode entities, collapse spaces
function clean(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const withoutTags = withoutCdata.replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

function readTag(block: string, name: string): string | null {
  const pattern = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,
    "i",
  );
  const match = block.match(pattern);
  return match ? match[1] : null;
}

function readAtomLink(block: string): string | null {
  // Atom uses <link href="..."/>. Pick rel="alternate" or no rel.
  for (const match of block.matchAll(/<link\b([^>]*)\/?>/gi)) {
    const attrs = match[1];
    const rel = /rel="([^"]+)"/i.exec(attrs)?.[1] ?? "alternate";
    const href = /href="([^"]+)"/i.exec(attrs)?.[1];
    if (href && rel === "alternate") return decodeEntities(href);
  }
  return null;
}

const TIMEZONE_ABBR: Record<string, string> = {
  WIB: "+0700",
  WITA: "+0800",
  WIT: "+0900",
};

function parseDate(raw: string | null): number {
  if (!raw) return 0;
  const text = clean(raw).replace(
    /\b(WIB|WITA|WIT)\b/,
    (abbr) => TIMEZONE_ABBR[abbr] ?? abbr,
  );
  const time = Date.parse(text);
  return Number.isNaN(time) ? 0 : time;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function parseFeed(xml: string, source: string): NewsItem[] {
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  const items: NewsItem[] = [];

  for (const block of blocks.slice(0, MAX_ITEMS_PER_FEED)) {
    const title = clean(readTag(block, "title") ?? "");
    const link = readAtomLink(block) ?? pickRssLink(block);

    if (!title || !isHttpUrl(link)) continue;

    const dateRaw =
      readTag(block, "pubDate") ??
      readTag(block, "dc:date") ??
      readTag(block, "published") ??
      readTag(block, "updated");

    items.push({
      title: title.slice(0, 180),
      link,
      source,
      publishedAt: parseDate(dateRaw),
    });
  }

  return items;
}

function pickRssLink(block: string): string {
  const direct = clean(readTag(block, "link") ?? "");
  if (isHttpUrl(direct)) return direct;
  const guid = clean(readTag(block, "guid") ?? "");
  return isHttpUrl(guid) ? guid : "";
}

// Remove duplicates by link, newest first
export function mergeItems(lists: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of lists.flat()) {
    const key = item.link
      .replace(/[?#].*$/, "")
      .replace(/\/$/, "")
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.sort((a, b) => b.publishedAt - a.publishedAt);
}
