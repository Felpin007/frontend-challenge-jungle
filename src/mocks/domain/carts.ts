import type { Cart, CartItem, Network, Quote, QuoteIssue, QuoteLine } from '@/api/contracts'
import { addEth, compareEth, mulEth, percentOf, subEth } from '@/lib/money'
import {
  db,
  nextId,
  nowIso,
  persist,
  type CartOwner,
  type CartRecord,
  type QuoteRecord,
} from '../db'
import { findEdition } from './catalog'

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

const QUOTE_TTL_MS = 5 * 60 * 1000

export class DomainError extends Error {
  constructor(
    public status: number,
    public code:
      | 'NOT_FOUND'
      | 'AVAILABILITY_CONFLICT'
      | 'COUPON_INVALID'
      | 'COUPON_EXPIRED'
      | 'VALIDATION_ERROR',
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

function sameOwner(a: CartOwner, b: CartOwner) {
  return a.type === 'user' && b.type === 'user'
    ? a.userId === b.userId
    : a.type === 'guest' && b.type === 'guest' && a.guestId === b.guestId
}

export function findCart(owner: CartOwner) {
  return db().carts.find((c) => sameOwner(c.owner, owner))
}

export function getOrCreateCart(owner: CartOwner): CartRecord {
  const existing = findCart(owner)
  if (existing) return existing
  const cart: CartRecord = {
    id: nextId('cart'),
    owner,
    items: [],
    couponCode: null,
    version: 1,
    updatedAt: nowIso(),
  }
  db().carts.push(cart)
  persist()
  return cart
}

function touch(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = nowIso()
  persist()
}

function maxQuantityFor(nftId: string, editionId: string) {
  const found = findEdition(nftId, editionId)
  if (!found) return 0
  return Math.min(found.edition.available, found.edition.maxPerOrder)
}

export function cartView(cart: CartRecord): Cart {
  const items: CartItem[] = []
  for (const item of cart.items) {
    const found = findEdition(item.nftId, item.editionId)
    if (!found) continue
    const { nft, edition } = found
    const maxQuantity = Math.min(edition.available, edition.maxPerOrder)
    const priceChanged = compareEth(edition.price, item.addedUnitPrice) !== 0
    items.push({
      id: item.id,
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenNumber: nft.tokenId,
      image: nft.image,
      quantity: item.quantity,
      unitPrice: edition.price,
      lineTotal: mulEth(edition.price, item.quantity),
      maxQuantity,
      previousUnitPrice: priceChanged ? item.addedUnitPrice : null,
      status:
        edition.available === 0
          ? 'sold_out'
          : item.quantity > maxQuantity
            ? 'insufficient'
            : priceChanged
              ? 'price_changed'
              : 'ok',
    })
  }
  return {
    id: cart.id,
    owner: cart.owner.type,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    couponCode: cart.couponCode,
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

function availabilityError(maxQuantity: number) {
  return new DomainError(
    409,
    'AVAILABILITY_CONFLICT',
    maxQuantity === 0
      ? 'Esta edição está esgotada.'
      : `Quantidade indisponível. Máximo para esta edição: ${maxQuantity}.`,
    { maxQuantity },
  )
}

export function addItem(
  cart: CartRecord,
  input: { nftId: string; editionId: string; quantity: number },
) {
  const found = findEdition(input.nftId, input.editionId)
  if (!found) throw new DomainError(404, 'NOT_FOUND', 'NFT ou edição não encontrados.')
  const max = maxQuantityFor(input.nftId, input.editionId)
  const id = `${input.nftId}:${input.editionId}`
  const existing = cart.items.find((i) => i.id === id)
  const nextQuantity = (existing?.quantity ?? 0) + input.quantity
  if (nextQuantity > max) throw availabilityError(max)
  if (existing) {
    existing.quantity = nextQuantity
  } else {
    cart.items.push({
      id,
      nftId: input.nftId,
      editionId: input.editionId,
      quantity: input.quantity,
      addedUnitPrice: found.edition.price,
    })
  }
  touch(cart)
}

export function updateItem(cart: CartRecord, itemId: string, quantity: number) {
  const item = cart.items.find((i) => i.id === itemId)
  if (!item) throw new DomainError(404, 'NOT_FOUND', 'Item não está no carrinho.')
  const max = maxQuantityFor(item.nftId, item.editionId)
  // Permite reduzir mesmo acima do máximo (para o usuário corrigir), mas não aumentar.
  if (quantity > max && quantity >= item.quantity) throw availabilityError(max)
  item.quantity = quantity
  touch(cart)
}

export function removeItem(cart: CartRecord, itemId: string) {
  const before = cart.items.length
  cart.items = cart.items.filter((i) => i.id !== itemId)
  if (cart.items.length === before)
    throw new DomainError(404, 'NOT_FOUND', 'Item não está no carrinho.')
  touch(cart)
}

/** Usuário reconhece as mudanças de preço: o preço atual passa a ser a referência. */
export function acknowledgeChanges(cart: CartRecord) {
  for (const item of cart.items) {
    const found = findEdition(item.nftId, item.editionId)
    if (found) item.addedUnitPrice = found.edition.price
  }
  touch(cart)
}

/** Junta o carrinho do visitante ao do usuário, respeitando a disponibilidade. */
export function mergeCarts(guest: CartRecord, user: CartRecord) {
  for (const item of guest.items) {
    const max = maxQuantityFor(item.nftId, item.editionId)
    const existing = user.items.find((i) => i.id === item.id)
    if (existing) {
      existing.quantity = Math.min(max, existing.quantity + item.quantity)
    } else if (max > 0) {
      user.items.push({ ...item, quantity: Math.min(item.quantity, max) })
    }
  }
  user.items = user.items.filter((i) => i.quantity > 0)
  if (!user.couponCode && guest.couponCode) user.couponCode = guest.couponCode
  db().carts = db().carts.filter((c) => c.id !== guest.id)
  touch(user)
}

function couponState(code: string | null) {
  if (!code) return { status: 'none' as const, coupon: null }
  const coupon = db().coupons.find((c) => c.code === code.toUpperCase())
  if (!coupon) return { status: 'invalid' as const, coupon: null }
  if (Date.parse(coupon.expiresAt) <= Date.now())
    return { status: 'expired' as const, coupon: null }
  return { status: 'applied' as const, coupon }
}

export function applyCoupon(cart: CartRecord, code: string) {
  const state = couponState(code)
  if (state.status === 'invalid')
    throw new DomainError(422, 'COUPON_INVALID', 'Código promocional inválido.')
  if (state.status === 'expired')
    throw new DomainError(422, 'COUPON_EXPIRED', 'Este código promocional expirou.')
  cart.couponCode = code.toUpperCase()
  touch(cart)
}

export function removeCoupon(cart: CartRecord) {
  cart.couponCode = null
  touch(cart)
}

export function buildQuote(cart: CartRecord, network: Network, userId: string | null): QuoteRecord {
  const view = cartView(cart)
  const lines: QuoteLine[] = view.items.map((item) => ({
    itemId: item.id,
    nftId: item.nftId,
    editionId: item.editionId,
    editionLabel: item.editionLabel,
    name: item.name,
    tokenNumber: item.tokenNumber,
    image: item.image,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }))
  const issues: QuoteIssue[] = view.items.flatMap((item): QuoteIssue[] => {
    if (item.status === 'sold_out')
      return [
        {
          itemId: item.id,
          type: 'SOLD_OUT',
          message: `${item.name} (${item.editionLabel}) esgotou.`,
        },
      ]
    if (item.status === 'insufficient')
      return [
        {
          itemId: item.id,
          type: 'INSUFFICIENT_AVAILABILITY',
          message: `${item.name}: restam apenas ${item.maxQuantity} unidade(s).`,
        },
      ]
    if (item.status === 'price_changed')
      return [
        {
          itemId: item.id,
          type: 'PRICE_CHANGED',
          message: `${item.name}: preço mudou de ${item.previousUnitPrice} para ${item.unitPrice} ETH.`,
        },
      ]
    return []
  })

  const subtotal = lines.length ? addEth(...lines.map((l) => l.lineTotal)) : '0'
  const { status: couponStatus, coupon } = couponState(cart.couponCode)
  const discount = coupon ? percentOf(subtotal, coupon.percentOff) : '0'
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  const total = addEth(subEth(subtotal, discount), networkFee)
  const createdAt = Date.now()

  const quote: QuoteRecord = {
    id: nextId('quote'),
    cartId: cart.id,
    userId,
    cartVersion: cart.version,
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon: coupon
      ? { code: coupon.code, description: coupon.description, percentOff: coupon.percentOff }
      : null,
    couponStatus,
    issues,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(createdAt + QUOTE_TTL_MS).toISOString(),
  }
  const state = db()
  // Mantém só as cotações mais recentes (a validação do pedido compara com a atual)
  state.quotes = [...state.quotes.slice(-99), quote]
  persist()
  return quote
}

/** Compara o que importa para o usuário: itens, preços, cupom, taxa e total. */
export function quoteFingerprint(
  quote: Pick<Quote, 'lines' | 'discount' | 'networkFee' | 'total' | 'couponStatus'>,
) {
  return JSON.stringify({
    lines: quote.lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice]),
    discount: quote.discount,
    fee: quote.networkFee,
    total: quote.total,
    coupon: quote.couponStatus,
  })
}
