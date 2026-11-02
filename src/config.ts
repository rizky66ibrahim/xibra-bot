import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config = {
  // Token dari @BotFather untuk @xibra_bot. Jangan pernah di-commit.
  botToken: required('BOT_TOKEN'),
  // Base URL Xibra API, tanpa trailing slash
  apiBase: (process.env.XIBRA_API_BASE || 'http://localhost:8000').replace(/\/$/, ''),
  // Secret bersama antara bot dan API (header X-Telegram-Bot-Secret). Harus sama dengan API.
  botSecret: required('TELEGRAM_BOT_SECRET')
}
