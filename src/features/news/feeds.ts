// News categories and RSS sources. Each feed has backup URLs.
// Tried in order until one works. Verify the URLs on first run.

export interface Feed {
  source: string
  urls: string[]
}

export interface Category {
  id: string
  label: string
  icon: string
  aliases: string[]
  feeds: Feed[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'indonesia',
    label: 'Indonesia',
    icon: '🏛️',
    aliases: ['indonesia', 'nasional', 'umum', 'terkini'],
    feeds: [
      { source: 'Antara', urls: ['https://www.antaranews.com/rss/terkini.xml'] },
      {
        source: 'CNN Indonesia',
        urls: ['https://www.cnnindonesia.com/nasional/rss', 'https://www.cnnindonesia.com/rss']
      }
    ]
  },
  {
    id: 'ekonomi',
    label: 'Ekonomi & Pasar',
    icon: '💹',
    aliases: ['ekonomi', 'bisnis', 'saham', 'investasi', 'pasar', 'market'],
    feeds: [
      { source: 'Antara', urls: ['https://www.antaranews.com/rss/ekonomi.xml'] },
      { source: 'CNBC Indonesia', urls: ['https://www.cnbcindonesia.com/market/rss'] }
    ]
  },
  {
    id: 'teknologi',
    label: 'Teknologi',
    icon: '💻',
    aliases: ['teknologi', 'tekno', 'tech', 'ai', 'gadget'],
    feeds: [
      { source: 'Antara', urls: ['https://www.antaranews.com/rss/tekno.xml'] },
      { source: 'CNBC Indonesia', urls: ['https://www.cnbcindonesia.com/tech/rss'] }
    ]
  }
]

export function findCategory(input: string): Category | undefined {
  const key = input.trim().toLowerCase()
  return CATEGORIES.find((c) => c.id === key || c.aliases.includes(key))
}
