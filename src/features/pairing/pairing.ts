// /pair: links this Telegram account to a Xibra user with a one-time code.
import type { Bot } from "grammy";
import { config } from "../../core/config.js";

// Code format produced by the API: XIBRA-XXXX-XXXX
const CODE_PATTERN = /^XIBRA-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

async function pair(code: string, telegramUserId: number, telegramUsername: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}/api/v1/integrations/telegram/pair`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Telegram-Bot-Secret": config.botSecret,
      },
      body: JSON.stringify({ code, telegram_user_id: telegramUserId, telegram_username: telegramUsername }),
    });
  } catch {
    return "Xibra API sedang tidak bisa dihubungi. Coba lagi nanti.";
  }

  const body = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };

  if (response.ok && body.success) return "Akun Telegram berhasil dihubungkan ke Xibra.";
  if (response.status === 401) return "Konfigurasi bot belum benar. Hubungi pemilik Xibra.";
  if (response.status === 400 || response.status === 422) return body.message ?? "Pairing gagal. Periksa kode Anda.";
  return "Pairing gagal. Coba lagi beberapa saat lagi.";
}

export function registerPairing(bot: Bot): void {
  bot.command("pair", async (ctx) => {
    const code = (ctx.match ?? "").toString().trim().toUpperCase();

    if (!CODE_PATTERN.test(code)) {
      return ctx.reply("Format kode salah. Contoh: /pair XIBRA-AB12-CD34");
    }
    if (!ctx.from) return ctx.reply("Akun Telegram Anda tidak terbaca. Coba lagi.");

    // The code is never written to logs
    const message = await pair(code, ctx.from.id, ctx.from.username ?? "");
    return ctx.reply(message);
  });
}
