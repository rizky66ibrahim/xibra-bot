import { InlineKeyboard, type Context } from 'grammy'
import { CATEGORIES, findCategory, type Category } from '../news/feeds.js'
import { ago } from '../news/format.js'
import { loadCategory, type CategoryNews } from '../news/service.js'
import type { Flow } from '../wizard/types.js'
import { startFlow } from '../wizard/engine.js'

const COUNTS = [5, 10] as const
const NO_PREVIEW = { is_disabled: true }

function renderNews(category: Category, count: number, news: CategoryNews): string {
  const lines = [`📰 ${category.icon} Berita ${category.label}`, `Diperbarui ${ago(news.fetchedAt)}`, '']

  if (news.items.length === 0) {
    lines.push('Berita belum bisa dimuat. Coba lagi beberapa menit lagi.')
  } else {
    news.items.slice(0, count).forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title}`, `   ${item.source} · ${ago(item.publishedAt)}`, `   ${item.link}`, '')
    })
  }

  if (news.stale) lines.push('⚠️ Semua sumber gagal dimuat. Menampilkan data yang tersimpan sebelumnya.')
  if (news.failed.length > 0) lines.push(`⚠️ Gagal memuat: ${news.failed.join('; ')}`)

  return lines.join('\n').trim()
}

function actionKeyboard(category: Category, count: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 Muat ulang', `nr:${category.id}:${count}`)
    .text('📂 Kategori lain', 'm:news')
    .row()
    .text('🏠 Menu', 'm:menu')
}

export async function sendNews(ctx: Context, category: Category, count: number): Promise<void> {
  await ctx.replyWithChatAction('typing').catch(() => undefined)
  const news = await loadCategory(category, count)
  await ctx.reply(renderNews(category, count, news), {
    reply_markup: actionKeyboard(category, count),
    link_preview_options: NO_PREVIEW
  })
}

// Wizard: pilih kategori, lalu jumlah berita. Bisa dilewati dengan /berita <kategori>.
export const newsFlow: Flow = {
  id: 'berita',
  steps: [
    {
      kind: 'choice',
      key: 'category',
      prompt: 'Pilih kategori berita:',
      options: CATEGORIES.map((c) => ({ label: `${c.icon} ${c.label}`, value: c.id }))
    },
    {
      kind: 'choice',
      key: 'count',
      prompt: 'Berapa berita yang ingin ditampilkan?',
      options: COUNTS.map((n) => ({ label: `${n} berita`, value: String(n) }))
    }
  ],
  finish: async (ctx, answers) => {
    const category = findCategory(answers.category ?? '')
    const count = Number(answers.count ?? COUNTS[0])
    if (!category) {
      await ctx.reply('Kategori tidak dikenali. Ketik /berita untuk memilih ulang.')
      return
    }
    await sendNews(ctx, category, count)
  }
}

export function startNewsWizard(ctx: Context, categoryInput?: string): Promise<void> {
  if (!categoryInput) return startFlow(ctx, newsFlow)

  const category = findCategory(categoryInput)
  if (!category) {
    const list = CATEGORIES.map((c) => `• ${c.id}`).join('\n')
    return ctx.reply(`Kategori tidak dikenal. Pilihan:\n${list}`).then(() => undefined)
  }
  return startFlow(ctx, newsFlow, { category: category.id })
}

// Tombol "Muat ulang" langsung mengambil berita tanpa wizard
export async function refreshNews(ctx: Context, categoryId: string, count: number): Promise<void> {
  const category = findCategory(categoryId)
  if (!category) {
    await ctx.answerCallbackQuery({ text: 'Kategori tidak dikenal.' }).catch(() => undefined)
    return
  }
  await ctx.answerCallbackQuery({ text: 'Memuat ulang...' }).catch(() => undefined)
  await sendNews(ctx, category, COUNTS.includes(count as 5 | 10) ? count : COUNTS[0])
}
