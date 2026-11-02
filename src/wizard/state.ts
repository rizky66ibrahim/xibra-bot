import type { Answers } from './types.js'

// Sesi percakapan disimpan di memori. Cukup untuk satu proses long polling.
// Jika bot dipindah ke banyak instance, pindahkan ke Redis atau database.
const SESSION_TTL_MS = 10 * 60 * 1000

export interface Session {
  flowId: string
  index: number
  answers: Answers
  expiresAt: number
}

const sessions = new Map<number, Session>()

export function getSession(userId: number): Session | undefined {
  const session = sessions.get(userId)
  if (!session) return undefined
  if (session.expiresAt < Date.now()) {
    sessions.delete(userId)
    return undefined
  }
  return session
}

export function saveSession(userId: number, session: Omit<Session, 'expiresAt'>): void {
  sessions.set(userId, { ...session, expiresAt: Date.now() + SESSION_TTL_MS })
}

export function clearSession(userId: number): void {
  sessions.delete(userId)
}
