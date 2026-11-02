import { InlineKeyboard, type Context } from "grammy";

export const PAIR_HINT =
  'Untuk menghubungkan akun: buka dashboard Xibra, klik "Generate pairing code", lalu kirim /pair KODE.';

export const HELP_TEXT = [
  "Perintah Xibra Bot:",
  "",
  "📰 Berita",
  "/berita  pilih kategori",
  "/berita teknologi  langsung ke kategori",
  "",
  "📝 Tugas",
  "/todo  daftar tugas",
  "/addtask  tambah tugas (wizard)",
  "/addtask beli susu  tambah cepat",
  "/done <id>  tandai selesai",
  "",
  "📅 Jadwal dan pengingat",
  "/jadwal  jadwal hari ini (atau /jadwal besok)",
  "/pengingat  daftar pengingat",
  "/ingatkan  tambah pengingat (wizard)",
  "/shift  shift hari ini (atau /shift besok)",
  "",
  "⚙️ Lainnya",
  "/menu  menu utama",
  "/pair <kode>  hubungkan akun",
  "/batal  batalkan proses yang sedang berjalan",
  "",
  PAIR_HINT,
].join("\n");

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📰 Berita", "m:news")
    .text("📝 Tugas", "m:todo")
    .row()
    .text("📅 Jadwal", "m:jadwal")
    .text("⏰ Pengingat", "m:pengingat")
    .row()
    .text("🕒 Shift", "m:shift")
    .text("❓ Bantuan", "m:help")
    .row()
    .text("💰 Keuangan", "m:soon:keuangan")
    .text("📧 Email", "m:soon:email");
}

export async function showMenu(ctx: Context): Promise<void> {
  await ctx.reply("Pilih fitur:", { reply_markup: mainMenuKeyboard() });
}

// Fitur yang belum tersedia, menunggu endpoint di Xibra API
export const COMING_SOON: Record<string, string> = {
  keuangan:
    "Keuangan akan tersedia setelah endpoint finance masuk ke jembatan API.",
  email:
    "Email membutuhkan login Gmail yang aman. Fitur ini dikerjakan setelah token disimpan di Xibra API.",
};
