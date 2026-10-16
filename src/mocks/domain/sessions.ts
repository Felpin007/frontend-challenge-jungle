import type { User } from '@/api/contracts'
import { randomHex } from '../crypto'
import { db, nowIso, persist, type UserRecord } from '../db'
import { getScenario } from '../scenarios'
import { publish } from './bus'

export function publicUser(record: UserRecord): User {
  const { salt: _salt, passwordHash: _hash, ...user } = record
  return user
}

export function createSession(userId: string) {
  const token = `kt_${randomHex(24)}`
  const expiresAt = new Date(Date.now() + getScenario().sessionTtlMs).toISOString()
  db().sessions.push({ token, userId, createdAt: nowIso(), expiresAt })
  persist()
  return { token, expiresAt }
}

export function resolveSession(
  token: string,
): { user: UserRecord; expiresAt: string } | 'expired' | null {
  const session = db().sessions.find((s) => s.token === token)
  if (!session) return null
  if (Date.parse(session.expiresAt) <= Date.now()) return 'expired'
  const user = db().users.find((u) => u.id === session.userId)
  return user ? { user, expiresAt: session.expiresAt } : null
}

export function endSession(token: string) {
  const state = db()
  state.sessions = state.sessions.filter((s) => s.token !== token)
  persist()
  publish('session.ended', { token })
}

/** Usado pelo painel/testes: expira todas as sessões ativas imediatamente. */
export function expireAllSessions() {
  const past = new Date(Date.now() - 1000).toISOString()
  for (const session of db().sessions) session.expiresAt = past
  persist()
}
