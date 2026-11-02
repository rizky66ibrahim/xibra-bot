// Format waktu relatif dalam Bahasa Indonesia
export function ago(ts: number, now = Date.now()): string {
  if (!ts) return 'waktu tidak diketahui'
  const minutes = Math.floor((now - ts) / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}
