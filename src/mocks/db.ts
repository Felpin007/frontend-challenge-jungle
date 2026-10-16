/**
 * Estado do "servidor" simulado. Fica em memória e é salvo no localStorage
 * após cada mutação, para sobreviver a refresh. `resetDb()` restaura o seed.
 *
 * Apenas o código em src/mocks acessa este módulo; o app conversa com ele
 * exclusivamente via HTTP (MSW) e Socket.IO.
 */
import type {
  EthAmount,
  NftDetail,
  Order,
  Quote,
  User,
  Wallet,
  WalletSession,
} from '@/api/contracts'
import { createSeed } from './seed'

export interface UserRecord extends User {
  salt: string
  passwordHash: string
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface CartItemRecord {
  id: string
  nftId: string
  editionId: string
  quantity: number
  /** Preço unitário no momento em que o item foi adicionado ou o aviso foi reconhecido. */
  addedUnitPrice: EthAmount
}

export type CartOwner = { type: 'user'; userId: string } | { type: 'guest'; guestId: string }

export interface CartRecord {
  id: string
  owner: CartOwner
  items: CartItemRecord[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface CouponRecord {
  code: string
  description: string
  percentOff: number
  expiresAt: string
}

export interface QuoteRecord extends Quote {
  cartId: string
  userId: string | null
}

export interface OrderRecord extends Order {
  idempotencyKey: string
  quoteId: string
  resolveAt: number
  outcome: 'confirm' | 'decline'
}

export interface DbState {
  schemaVersion: 1
  seq: number
  eventSeq: number
  users: UserRecord[]
  sessions: SessionRecord[]
  nfts: NftDetail[]
  favorites: Record<string, string[]>
  carts: CartRecord[]
  coupons: CouponRecord[]
  quotes: QuoteRecord[]
  wallets: Array<Wallet & { userId: string }>
  walletSessions: Array<WalletSession & { userId: string }>
  orders: OrderRecord[]
  idempotency: Record<string, { userId: string; requestHash: string; orderId: string }>
}

export const DB_STORAGE_KEY = 'kurio:mock-db:v1'

let state: DbState | null = null

export function db(): DbState {
  if (!state) throw new Error('Mock DB não inicializado')
  return state
}

export async function initDb(): Promise<DbState> {
  try {
    const saved = localStorage.getItem(DB_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as DbState
      if (parsed.schemaVersion === 1) {
        state = parsed
        return state
      }
    }
  } catch {
    // dado corrompido ou storage bloqueado: recomeça do seed
  }
  state = await createSeed()
  persist()
  return state
}

export async function resetDb(): Promise<DbState> {
  state = await createSeed()
  persist()
  return state
}

export function persist(): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // sem storage: o estado continua válido em memória
  }
}

export function nextId(prefix: string): string {
  const s = db()
  s.seq += 1
  return `${prefix}-${s.seq}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
