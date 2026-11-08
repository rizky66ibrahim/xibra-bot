// /help: short command list. Kept deliberately small.
import type { Bot } from "grammy";

export const HELP_TEXT = [
  "Perintah Xibra Bot",
  "",
  "/start  ringkasan hari ini",
  "/task  tugas (ubah, hapus, selesai)",
  "/schedule  jadwal hari ini (atau /schedule besok)",
  "/week  7 hari ke depan",
  "/reminder  pengingat mendatang",
  "/shift  shift, blok malam, dan standby Jumat",
  "/news  berita terbaru (atau /news teknologi)",
  "/weather  cuaca hari ini",
  "/expense 25k makan siang  catat pengeluaran",
  "/income 5jt gaji  catat pemasukan",
  "/balance  kas, bank, investasi, dan ringkasan bulan ini",
  "/add  tambah tugas atau jadwal",
  "/pair KODE  hubungkan akun Xibra",
  "/cancel  batalkan langkah yang sedang berjalan",
  "",
  "Salah input? Buka daftar tugas, jadwal, atau shift, lalu tekan tombol Ubah atau Hapus.",
  "Sebagian besar hal bisa dilakukan dengan tombol. Anda juga bisa mengetik jawaban saat bot bertanya.",
].join("\n");

export function registerHelp(bot: Bot): void {
  bot.command("help", (ctx) => ctx.reply(HELP_TEXT));
}
