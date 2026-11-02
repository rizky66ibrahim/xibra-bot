import { InlineKeyboard, type Context } from 'grammy'

export const HELP_TEXT = [
  'Halo, saya Xibra Bot.',
  '',
  'Perintah:',
  '/menu  menu utama',
  '/berita  berita terkini (pilih kategori)',
  '/berita teknologi  langsung ke kategori tertentu',
  '/pair XIBRA-XXXX-XXXX  hubungkan akun Xibra',
  '/batal  batalkan proses yang sedang berjalan',
  '',
  'Untuk menghubungkan akun: buka dashboard Xibra, klik "Generate pairing code", lalu kirim kodenya dengan /pair.'
].join('\n')

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📰 Berita', 'm:news')
    .text('📝 Tugas', 'm:soon:tugas')
    .row()
    .text('💰 Keuangan', 'm:soon:keuangan')
    .text('📧 Email', 'm:soon:email')
    .row()
    .text('❓ Bantuan', 'm:help')
}

export async function showMenu(ctx: Context): Promise<void> {
  await ctx.reply('Pilih fitur:', { reply_markup: mainMenuKeyboard() })
}

// Fitur yang belum tersedia, menunggu endpoint di Xibra API
export const COMING_SOON: Record<string, string> = {
  tugas: 'Tugas akan tersedia setelah bot terhubung ke Xibra API (Phase 3).',
  keuangan: 'Keuangan akan tersedia setelah bot terhubung ke Xibra API (Phase 5).',
  email: 'Email membutuhkan login Gmail yang aman. Fitur ini dikerjakan setelah token disimpan di Xibra API.'
}
