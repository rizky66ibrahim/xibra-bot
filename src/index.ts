import { createBot } from './bot.js'

const bot = createBot()

// Long polling untuk pengembangan lokal.
// Untuk VPS nanti, ganti dengan webhook di belakang Nginx.
const stop = () => {
  console.log('Stopping Xibra Bot...')
  bot.stop()
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)

bot.start({
  onStart: (info) => console.log(`Xibra Bot running as @${info.username}`)
})
