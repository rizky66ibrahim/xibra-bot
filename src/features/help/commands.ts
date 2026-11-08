// The one list of bot commands. It feeds the "/" menu in Telegram (setMyCommands),
// the text you can paste into @BotFather, and the tests.

export interface BotCommand {
  command: string;
  description: string;
}

export const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Ringkasan hari ini" },
  { command: "task", description: "Tugas yang belum selesai" },
  { command: "schedule", description: "Jadwal hari ini" },
  { command: "week", description: "Jadwal 7 hari ke depan" },
  { command: "reminder", description: "Pengingat mendatang" },
  { command: "shift", description: "Shift, blok malam, standby Jumat" },
  { command: "news", description: "Berita terbaru" },
  { command: "weather", description: "Cuaca hari ini" },
  { command: "balance", description: "Saldo kas, bank, dan investasi" },
  { command: "expense", description: "Catat pengeluaran" },
  { command: "income", description: "Catat pemasukan" },
  { command: "add", description: "Tambah tugas atau jadwal" },
  { command: "pair", description: "Hubungkan akun Xibra" },
  { command: "cancel", description: "Batalkan langkah yang berjalan" },
  { command: "help", description: "Daftar perintah" },
];

// The format @BotFather asks for after /setcommands: "command - description", one per line
export function toBotFatherText(commands: BotCommand[] = BOT_COMMANDS): string {
  return commands.map((c) => `${c.command} - ${c.description}`).join("\n");
}
