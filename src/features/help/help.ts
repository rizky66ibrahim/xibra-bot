// /help: short command list. Kept deliberately small.
import type { Bot } from "grammy";

export const HELP_TEXT = [
  "Perintah Xibra Bot",
  "",
  "/start  ringkasan hari ini",
  "/task  tugas belum selesai",
  "/schedule  jadwal hari ini (atau /schedule besok)",
  "/week  7 hari ke depan",
  "/reminder  pengingat mendatang",
  "/shift  shift, blok malam, dan standby Jumat",
  "/news  berita terbaru (atau /news teknologi)",
  "/expense 25k makan siang  catat pengeluaran",
  "/balance  saldo akun dan ringkasan bulan ini",
  "/add  tambah tugas, jadwal, atau pengingat",
  "/pair KODE  hubungkan akun Xibra",
  "/cancel  batalkan langkah yang sedang berjalan",
  "",
  "Sebagian besar hal bisa dilakukan dengan tombol. Anda juga bisa mengetik jawaban saat bot bertanya.",
].join("\n");

export function registerHelp(bot: Bot): void {
  bot.command("help", (ctx) => ctx.reply(HELP_TEXT));
}
