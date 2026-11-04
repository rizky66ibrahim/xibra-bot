// News categories and RSS sources. Each feed has backup URLs.
// Tried in order until one works. Verify the URLs on first run.

export interface Feed {
  source: string;
  urls: string[];
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  aliases: string[];
  feeds: Feed[];
}

export const CATEGORIES: Category[] = [
  {
    id: "indonesia",
    label: "Indonesia",
    icon: "🏛️",
    aliases: ["indonesia", "nasional", "umum", "terkini"],
    feeds: [
      {
        source: "Antara",
        urls: ["https://www.antaranews.com/rss/terkini.xml"],
      },
      {
        source: "CNN Indonesia",
        urls: [
          "https://www.cnnindonesia.com/nasional/rss",
          "https://www.cnnindonesia.com/rss",
        ],
      },
    ],
  },
  {
    id: "ekonomi",
    label: "Ekonomi & Saham",
    icon: "💹",
    aliases: ["ekonomi", "bisnis", "saham", "investasi", "pasar", "market"],
    feeds: [
      {
        source: "Antara",
        urls: ["https://www.antaranews.com/rss/ekonomi.xml"],
      },
      {
        source: "CNBC Indonesia",
        urls: ["https://www.cnbcindonesia.com/market/rss"],
      },
    ],
  },
  {
    id: "teknologi",
    label: "Teknologi",
    icon: "💻",
    aliases: ["teknologi", "tekno", "tech", "ai", "gadget"],
    feeds: [
      { source: "Antara", urls: ["https://www.antaranews.com/rss/tekno.xml"] },
      {
        source: "CNBC Indonesia",
        urls: ["https://www.cnbcindonesia.com/tech/rss"],
      },
    ],
  },

  {
    id: "global",
    label: "Global",
    icon: "🌍",
    aliases: ["global", "dunia", "internasional", "world"],
    feeds: [
      {
        source: "BBC Indonesia",
        urls: ["https://feeds.bbci.co.uk/indonesia/rss.xml"],
      },
      {
        source: "CNA Dunia",
        urls: [
          "https://www.cna.id/api/v1/rss-outbound-feed?_format=xml&category=3136",
        ],
      },
      {
        source: "BBC World",
        urls: ["https://feeds.bbci.co.uk/news/world/rss.xml"],
      },
      {
        source: "Al Jazeera",
        urls: ["https://www.aljazeera.com/xml/rss/all.xml"],
      },
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    icon: "₿",
    aliases: [
      "crypto",
      "cryptocurrency",
      "bitcoin",
      "btc",
      "ethereum",
      "eth",
      "blockchain",
      "kripto",
    ],
    feeds: [
      {
        source: "Pintu News",
        urls: ["https://pintu.co.id/news/rss-feed.xml"],
      },
      {
        source: "Pintu Bitcoin",
        urls: ["https://pintu.co.id/news/categories/bitcoin/rss-feed.xml"],
      },
      {
        source: "Pintu Market",
        urls: ["https://pintu.co.id/news/categories/market/rss-feed.xml"],
      },
      {
        source: "Cointelegraph",
        urls: ["https://cointelegraph.com/rss"],
      },
      {
        source: "CoinDesk",
        urls: [
          "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml",
        ],
      },
      {
        source: "The Block",
        urls: ["https://www.theblock.co/rss.xml"],
      },
    ],
  },
  {
    id: "gaming",
    label: "Gaming",
    icon: "🎮",
    aliases: [
      "gaming",
      "game",
      "games",
      "esports",
      "e-sports",
      "valorant",
      "gaming news",
    ],
    feeds: [
      {
        source: "Google News Indonesia",
        urls: [
          "https://news.google.com/rss/search?q=game%20OR%20gaming%20OR%20esports&hl=id&gl=ID&ceid=ID:id",
        ],
      },
      {
        source: "IGN",
        urls: ["https://www.ign.com/rss/v2/articles/feed"],
      },
      {
        source: "PC Gamer",
        urls: ["https://www.pcgamer.com/feeds.xml"],
      },
      {
        source: "Kotaku",
        urls: ["https://kotaku.com/rss"],
      },
      {
        source: "GameSpot",
        urls: ["https://www.gamespot.com/feeds/mashup/"],
      },
    ],
  },
];

export function findCategory(input: string): Category | undefined {
  const key = input.trim().toLowerCase();
  return CATEGORIES.find((c) => c.id === key || c.aliases.includes(key));
}
