import type { Category, Feed } from './feeds.js'
import { mergeItems, parseFeed, type NewsItem } from './rss.js'

const FETCH_TIMEOUT_MS = 6_000
const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_CACHED_ITEMS = 50
const USER_AGENT = 'Mozilla/5.0 (compatible; XibraBot/0.2)'

interface CacheEntry {
  at: number
  items: NewsItem[]
  failed: string[]
}

const cache = new Map<string, CacheEntry>()

export interface CategoryNews {
  items: NewsItem[]
  // Source names that failed on the last fetch
  failed: string[]
  // true when stale cached data is shown because every source failed
  stale: boolean
  fetchedAt: number
}

// Tries each feed URL in order until one works
async function fetchFeed(feed: Feed): Promise<NewsItem[]> {
  let lastError = 'tidak ada alamat'

  for (const url of feed.urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5'
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      })

      if (!response.ok) {
        lastError = `HTTP ${response.status}`
        continue
      }

      const items = parseFeed(await response.text(), feed.source)
      if (items.length === 0) {
        lastError = 'tidak ada item yang bisa dibaca'
        continue
      }
      return items
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  throw new Error(lastError)
}

export async function loadCategory(category: Category, limit: number): Promise<CategoryNews> {
  const cached = cache.get(category.id)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { items: cached.items.slice(0, limit), failed: cached.failed, stale: false, fetchedAt: cached.at }
  }

  const results = await Promise.allSettled(category.feeds.map((feed) => fetchFeed(feed)))

  const lists: NewsItem[][] = []
  const failed: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      lists.push(result.value)
    } else {
      const source = category.feeds[index].source
      failed.push(`${source} (${result.reason instanceof Error ? result.reason.message : 'gagal'})`)
    }
  })

  const items = mergeItems(lists)

  // All sources failed: fall back to cached data, never cache an empty result
  if (items.length === 0) {
    if (cached) {
      return { items: cached.items.slice(0, limit), failed, stale: true, fetchedAt: cached.at }
    }
    return { items: [], failed, stale: false, fetchedAt: Date.now() }
  }

  const entry: CacheEntry = { at: Date.now(), items: items.slice(0, MAX_CACHED_ITEMS), failed }
  cache.set(category.id, entry)

  return { items: items.slice(0, limit), failed, stale: false, fetchedAt: entry.at }
}
