import { config } from './config.js'

export type PairResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

interface PairInput {
  code: string
  telegramUserId: number
  telegramUsername: string
}

// Memanggil POST /api/v1/integrations/telegram/pair di Xibra API.
// Hanya membawa secret bot, tanpa token user.
export async function pairTelegramAccount(input: PairInput): Promise<PairResult> {
  let response: Response

  try {
    response = await fetch(`${config.apiBase}/api/v1/integrations/telegram/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Telegram-Bot-Secret': config.botSecret
      },
      body: JSON.stringify({
        code: input.code,
        telegram_user_id: input.telegramUserId,
        telegram_username: input.telegramUsername
      })
    })
  } catch (err) {
    console.error('Xibra API unreachable:', (err as Error).message)
    return { ok: false, message: 'Xibra API sedang tidak bisa dihubungi. Coba lagi nanti.' }
  }

  const body = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string }

  if (response.ok && body.success) {
    return { ok: true, message: 'Akun Telegram berhasil dihubungkan ke Xibra.' }
  }

  // 401 berarti secret bot tidak cocok. Ini kesalahan konfigurasi, jangan tampilkan detailnya ke user.
  if (response.status === 401) {
    console.error('Pairing rejected: bot secret does not match the API configuration.')
    return { ok: false, message: 'Konfigurasi bot belum benar. Hubungi pemilik Xibra.' }
  }

  // 400 dan 422 dari API sudah berupa pesan yang aman ditampilkan, misalnya kode kedaluwarsa.
  if (response.status === 400 || response.status === 422) {
    return { ok: false, message: body.message || 'Pairing gagal. Periksa kode Anda.' }
  }

  // Status lain (429, 5xx): pesan generik
  console.error(`Pairing failed with HTTP ${response.status}`)
  return { ok: false, message: 'Pairing gagal. Coba lagi beberapa saat lagi.' }
}
