import { useSyncExternalStore } from 'react'

/**
 * Guarda o token da sessão (localStorage) para recuperar a sessão após refresh.
 * É um store externo mínimo (useSyncExternalStore), porque o token precisa ser
 * lido fora do React: no interceptor do Axios e na conexão do Socket.IO.
 * Os dados do usuário em si ficam no cache do TanStack Query.
 */
export interface StoredSession {
  token: string
  userId: string
  expiresAt: string
}

export type SessionEndReason = 'logout' | 'expired'

const KEY = 'kurio:session'
const listeners = new Set<() => void>()

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

let current = read()
let lastEndReason: SessionEndReason | null = null

function emit() {
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: () => current,
  lastEndReason: () => lastEndReason,
  set(session: StoredSession) {
    current = session
    lastEndReason = null
    try {
      localStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      // sem storage: a sessão vale até o refresh
    }
    emit()
  },
  clear(reason: SessionEndReason) {
    if (!current) return
    current = null
    lastEndReason = reason
    try {
      localStorage.removeItem(KEY)
    } catch {
      // ignorado
    }
    emit()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// Outra aba fez login/logout: mantém esta aba coerente.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    const next = read()
    if (next?.token === current?.token) return
    current = next
    lastEndReason = next ? null : 'logout'
    emit()
  })
}

export function useStoredSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
}
