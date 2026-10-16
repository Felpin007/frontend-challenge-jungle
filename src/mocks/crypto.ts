/**
 * O "servidor" simulado nunca guarda senha em claro: armazena SHA-256(salt:senha).
 * Num backend real usaríamos um hash lento (bcrypt/argon2); aqui o objetivo é
 * apenas não persistir a senha no localStorage.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

export function randomHex(bytes: number): string {
  const array = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Hash estável (FNV-1a) para comparar o conteúdo de requisições idempotentes. */
export function stableHash(value: unknown): string {
  const text = JSON.stringify(value, Object.keys(flatten(value)).sort())
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

function flatten(value: unknown, acc: Record<string, true> = {}): Record<string, true> {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      acc[k] = true
      flatten(v, acc)
    }
  }
  return acc
}
