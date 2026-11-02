import { Bot } from 'grammy'
import { config } from './config.js'
import { pairTelegramAccount } from './api.js'
import { HELP_TEXT, COMING_SOON, showMenu } from './handlers/menu.js'
import { newsFlow, refreshNews, startNewsWizard } from './handlers/news.js'
import { registerFlow, handleCallback, handleText } from './wizard/engine.js'
import { clearSession } from './wizard/state.js'

// Format kode dari API: XIBRA-XXXX-XXXX (huruf besar dan angka)
const CODE_PATTERN = /^XIBRA-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export function createBot(): Bot {
  const bot = new Bot(config.botToken)

  registerFlow(newsFlow)

  bot.command(['start', 'menu'], async (ctx) => {
    await ctx.reply('Selamat datang di Xibra Bot. Ketik /help untuk daftar perintah.')
    await showMenu(ctx)
  })

  bot.command('help', (ctx) => ctx.reply(HELP_TEXT))

  bot.command('berita', (ctx) => {
    const arg = ctx.match?.toString().trim() || undefined
    return startNewsWizard(ctx, arg)
  })

  bot.command('batal', async (ctx) => {
    if (ctx.from) clearSession(ctx.from.id)
    await ctx.reply('Proses dibatalkan.')
  })

  bot.command('pair', async (ctx) => {
    const code = (ctx.match ?? '').toString().trim().toUpperCase()

    if (!CODE_PATTERN.test(code)) {
      return ctx.reply('Format kode salah. Contoh: /pair XIBRA-AB12-CD34')
    }

    const from = ctx.from
    if (!from) {
      return ctx.reply('Akun Telegram Anda tidak terbaca. Coba lagi.')
    }

    // Kode tidak pernah ditulis ke log
    const result = await pairTelegramAccount({
      code,
      telegramUserId: from.id,
      telegramUsername: from.username ?? ''
    })

    return ctx.reply(result.message)
  })

  // Tombol wizard (w:...), tombol muat ulang berita (nr:...), dan menu utama (m:...)
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data

    if (await handleCallback(ctx)) return

    if (data.startsWith('nr:')) {
      const [, categoryId, count] = data.split(':')
      return refreshNews(ctx, categoryId, Number(count))
    }

    if (data === 'm:news') {
      await ctx.answerCallbackQuery().catch(() => undefined)
      return startNewsWizard(ctx)
    }

    if (data === 'm:menu') {
      await ctx.answerCallbackQuery().catch(() => undefined)
      return showMenu(ctx)
    }

    if (data === 'm:help') {
      await ctx.answerCallbackQuery().catch(() => undefined)
      return ctx.reply(HELP_TEXT)
    }

    if (data.startsWith('m:soon:')) {
      const key = data.slice('m:soon:'.length)
      await ctx.answerCallbackQuery({ text: 'Belum tersedia' }).catch(() => undefined)
      return ctx.reply(COMING_SOON[key] ?? 'Fitur ini belum tersedia.')
    }

    await ctx.answerCallbackQuery().catch(() => undefined)
  })

  // Teks biasa: dipakai oleh langkah wizard bertipe teks. Di luar wizard, arahkan ke menu.
  bot.on('message:text', async (ctx) => {
    if (await handleText(ctx)) return
    await ctx.reply('Ketik /menu untuk melihat fitur, atau /help untuk daftar perintah.')
  })

  bot.catch((err) => {
    console.error('Bot error:', err.error instanceof Error ? err.error.message : err.error)
  })

  return bot
}
