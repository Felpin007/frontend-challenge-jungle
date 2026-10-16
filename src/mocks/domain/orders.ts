import type { CollectorInfo, Order } from '@/api/contracts'
import { randomHex, stableHash } from '../crypto'
import { db, nextId, nowIso, persist, type OrderRecord } from '../db'
import { getScenario } from '../scenarios'
import { publish } from './bus'
import { buildQuote, findCart, quoteFingerprint } from './carts'
import { findEdition, recomputeNft } from './catalog'

const EXPLORERS = {
  ethereum: 'https://sepolia.etherscan.io/tx/',
  polygon: 'https://amoy.polygonscan.com/tx/',
  solana: 'https://explorer.solana.com/tx/',
} as const

export type CreateOrderResult =
  | { kind: 'created' | 'replayed'; order: OrderRecord }
  | {
      kind: 'error'
      status: number
      code:
        | 'IDEMPOTENCY_CONFLICT'
        | 'ORDER_PENDING'
        | 'QUOTE_OUTDATED'
        | 'AVAILABILITY_CONFLICT'
        | 'NOT_FOUND'
        | 'VALIDATION_ERROR'
        | 'WALLET_REJECTED'
      message: string
      details?: unknown
    }

export function toOrder(record: OrderRecord): Order {
  const { idempotencyKey: _k, quoteId: _q, resolveAt: _r, outcome: _o, ...order } = record
  return order
}

export function createOrder(
  userId: string,
  idempotencyKey: string,
  body: { quoteId: string; walletSessionId: string; collector: CollectorInfo },
): CreateOrderResult {
  const state = db()
  const requestHash = stableHash(body)

  // 1. Idempotência: mesma chave + mesmo conteúdo = mesmo pedido.
  const previous = state.idempotency[idempotencyKey]
  if (previous) {
    if (previous.userId !== userId || previous.requestHash !== requestHash) {
      return {
        kind: 'error',
        status: 409,
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Esta chave de idempotência já foi usada com outro conteúdo.',
      }
    }
    const order = state.orders.find((o) => o.id === previous.orderId)
    if (order) return { kind: 'replayed', order: resolveIfDue(order) }
  }

  // 2. Um pedido pendente por usuário: o carrinho só é baixado quando o pedido confirma,
  //    então uma segunda compra com outra chave (ex.: após um timeout em que a primeira
  //    resposta se perdeu) compraria os mesmos itens de novo.
  const pending = state.orders.find(
    (o) => o.userId === userId && resolveIfDue(o).status === 'pending',
  )
  if (pending) {
    return {
      kind: 'error',
      status: 409,
      code: 'ORDER_PENDING',
      message: 'Você já tem um pedido aguardando confirmação. Acompanhe o pedido em andamento.',
      details: { orderId: pending.id },
    }
  }

  // 3. Revalida a cotação contra o estado atual do carrinho e do catálogo.
  const quote = state.quotes.find((q) => q.id === body.quoteId && q.userId === userId)
  const cart = findCart({ type: 'user', userId })
  if (!cart || cart.items.length === 0) {
    return {
      kind: 'error',
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Seu carrinho está vazio.',
    }
  }
  const session = state.walletSessions.find(
    (s) => s.id === body.walletSessionId && s.userId === userId,
  )
  if (!session || session.status !== 'connected') {
    return {
      kind: 'error',
      status: 422,
      code: 'WALLET_REJECTED',
      message: 'Conecte uma carteira antes de confirmar.',
    }
  }
  const fresh = buildQuote(cart, session.network, userId)
  const expired = !quote || Date.parse(quote.expiresAt) <= Date.now()
  if (
    expired ||
    quoteFingerprint(quote) !== quoteFingerprint(fresh) ||
    quote.network !== session.network
  ) {
    return {
      kind: 'error',
      status: 409,
      code: 'QUOTE_OUTDATED',
      message: expired
        ? 'A cotação expirou. Revise os valores atualizados.'
        : 'Preço, disponibilidade, cupom ou taxa mudaram. Revise os valores atualizados.',
      details: { quote: fresh },
    }
  }
  const blocking = fresh.issues.filter((i) => i.type !== 'PRICE_CHANGED')
  if (blocking.length) {
    return {
      kind: 'error',
      status: 409,
      code: 'AVAILABILITY_CONFLICT',
      message: blocking[0].message,
      details: { quote: fresh },
    }
  }

  // 4. Cria o pedido pendente e reserva o estoque.
  const wallet = state.wallets.find((w) => w.id === session.walletId)
  const at = nowIso()
  const order: OrderRecord = {
    id: nextId('order'),
    number: `KUR-${state.seq}`,
    userId,
    status: 'pending',
    version: 1,
    lines: fresh.lines,
    subtotal: fresh.subtotal,
    discount: fresh.discount,
    networkFee: fresh.networkFee,
    total: fresh.total,
    coupon: fresh.coupon,
    network: fresh.network,
    wallet: {
      id: session.walletId,
      nickname: wallet?.nickname ?? 'Carteira',
      address: session.address,
      provider: session.provider,
    },
    transaction: null,
    declineReason: null,
    createdAt: at,
    updatedAt: at,
    idempotencyKey,
    quoteId: fresh.id,
    resolveAt: Date.now() + getScenario().orderResolutionMs,
    outcome: getScenario().payment,
  }
  for (const line of order.lines) adjustStock(line.nftId, line.editionId, -line.quantity)
  state.orders.push(order)
  state.idempotency[idempotencyKey] = { userId, requestHash, orderId: order.id }
  persist()
  scheduleResolution(order)
  return { kind: 'created', order }
}

function adjustStock(nftId: string, editionId: string, delta: number) {
  const found = findEdition(nftId, editionId)
  if (!found) return
  found.edition.available = Math.max(0, found.edition.available + delta)
  recomputeNft(found.nft)
  publish('nft.changed', found.nft)
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleResolution(order: OrderRecord) {
  clearTimeout(timers.get(order.id))
  timers.set(
    order.id,
    setTimeout(() => resolveIfDue(order, true), Math.max(0, order.resolveAt - Date.now())),
  )
}

/** Retoma pedidos pendentes após recarregar a página (o "servidor" reinicia junto). */
export function resumePendingOrders() {
  for (const order of db().orders) if (order.status === 'pending') scheduleResolution(order)
}

/** Resolve o pedido se o prazo já passou. Também é chamado nas consultas REST. */
export function resolveIfDue(order: OrderRecord, force = false): OrderRecord {
  if (order.status !== 'pending' || (!force && Date.now() < order.resolveAt)) return order
  timers.delete(order.id)
  order.status = order.outcome === 'confirm' ? 'confirmed' : 'declined'
  order.version += 1
  order.updatedAt = nowIso()

  if (order.status === 'confirmed') {
    const hash = `0x${randomHex(32)}`
    order.transaction = { hash, explorerUrl: `${EXPLORERS[order.network]}${hash}` }
    // Remove do carrinho só os itens e quantidades comprados.
    const cart = findCart({ type: 'user', userId: order.userId })
    if (cart) {
      for (const line of order.lines) {
        const item = cart.items.find(
          (i) => i.nftId === line.nftId && i.editionId === line.editionId,
        )
        if (item) item.quantity -= line.quantity
      }
      cart.items = cart.items.filter((i) => i.quantity > 0)
      if (order.coupon && cart.couponCode === order.coupon.code) cart.couponCode = null
      cart.version += 1
      cart.updatedAt = nowIso()
    }
  } else {
    order.declineReason = 'A carteira recusou a assinatura da transação.'
    for (const line of order.lines) adjustStock(line.nftId, line.editionId, line.quantity)
  }
  persist()
  publish('order.changed', toOrder(order))
  return order
}

export function findOrder(userId: string, orderId: string) {
  const order = db().orders.find((o) => o.id === orderId)
  if (!order) return undefined
  if (order.userId !== userId) return 'forbidden' as const
  return resolveIfDue(order)
}
