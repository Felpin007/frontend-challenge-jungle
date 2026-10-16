import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import {
  AddCartItemRequest,
  ApplyCouponRequest,
  Network,
  UpdateCartItemRequest,
} from '@/api/contracts'
import type { CartOwner } from '../db'
import {
  acknowledgeChanges,
  addItem,
  applyCoupon,
  buildQuote,
  cartView,
  DomainError,
  findCart,
  getOrCreateCart,
  mergeCarts,
  removeCoupon,
  removeItem,
  updateItem,
} from '../domain/carts'
import {
  apiError,
  authenticate,
  guestCartId,
  optionalUser,
  parseBody,
  simulate,
} from '../mock-http'

/** Carrinho do usuário autenticado; sem sessão, o carrinho do visitante (header X-Cart-Id). */
function resolveOwner(
  request: Request,
): { owner: CartOwner; userId: string | null } | { response: Response } {
  const auth = optionalUser(request)
  if ('response' in auth) return auth
  if (auth.user) return { owner: { type: 'user', userId: auth.user.id }, userId: auth.user.id }
  const guestId = guestCartId(request)
  if (!guestId) return { response: apiError(422, 'VALIDATION_ERROR', 'Header X-Cart-Id ausente.') }
  return { owner: { type: 'guest', guestId }, userId: null }
}

function handleDomain(run: () => Response): Response {
  try {
    return run()
  } catch (error) {
    if (error instanceof DomainError) {
      return apiError(error.status, error.code, error.message, { details: error.details })
    }
    throw error
  }
}

export const cartHandlers = [
  http.get('/api/cart', async ({ request }) => {
    const failure = await simulate('cart', request)
    if (failure) return failure
    const resolved = resolveOwner(request)
    if ('response' in resolved) return resolved.response
    const cart = findCart(resolved.owner)
    if (!cart) {
      // Carrinho vazio "virtual": não cria registro só por consultar.
      return HttpResponse.json({
        id: 'empty',
        owner: resolved.owner.type,
        items: [],
        itemCount: 0,
        couponCode: null,
        version: 0,
        updatedAt: new Date(0).toISOString(),
      })
    }
    return HttpResponse.json(cartView(cart))
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const failure = await simulate('cart', request)
    if (failure) return failure
    const resolved = resolveOwner(request)
    if ('response' in resolved) return resolved.response
    const body = await parseBody(request, AddCartItemRequest)
    if ('response' in body) return body.response
    return handleDomain(() => {
      const cart = getOrCreateCart(resolved.owner)
      addItem(cart, body.data)
      return HttpResponse.json(cartView(cart))
    })
  }),

  http.patch('/api/cart/items/:itemId', async ({ request, params }) => {
    const failure = await simulate('cart', request)
    if (failure) return failure
    const resolved = resolveOwner(request)
    if ('response' in resolved) return resolved.response
    const body = await parseBody(request, UpdateCartItemRequest)
    if ('response' in body) return body.response
    return handleDomain(() => {
      const cart = getOrCreateCart(resolved.owner)
      updateItem(cart, decodeURIComponent(String(params.itemId)), body.data.quantity)
      return HttpResponse.json(cartView(cart))
    })
  }),

  http.delete('/api/cart/items/:itemId', async ({ request, params }) => {
    const failure = await simulate('cart', request)
    if (failure) return failure
    const resolved = resolveOwner(request)
    if ('response' in resolved) return resolved.response
    return handleDomain(() => {
      const cart = getOrCreateCart(resolved.owner)
      removeItem(cart, decodeURIComponent(String(params.itemId)))
      return HttpResponse.json(cartView(cart))
    })
  }),

  http.post('/api/cart/coupon', async ({ request }) => {
    const failure = await simulate('cart', request)
    if (failure) return failure
    const resolved = resolveOwner(request)
    if ('response' in resolved) return resolved.response
    const body = await parseBody(request, ApplyCouponRequest)
    if ('response' in body) return body.response
    return handleDomain(() => {
      const cart = getOrCreateCart(resolved.owner)
      applyCoupon(cart, body.data.code)
      return HttpResponse.json(cartView(cart))
    })
  }),

  http.delete('/api/cart/coupon', async ({ request }) => {
    const failure = await simulate('cart', request)
    if (failure) return failure
    const resolved = resolveOwner(request)
    if ('response' in resolved) return resolved.response
    const cart = getOrCreateCart(resolved.owner)
    removeCoupon(cart)
    return HttpResponse.json(cartView(cart))
  }),

  http.post('/api/cart/acknowledge', async ({ request }) => {
    const failure = await simulate('cart', request)
    if (failure) return failure
    const resolved = resolveOwner(request)
    if ('response' in resolved) return resolved.response
    const cart = getOrCreateCart(resolved.owner)
    acknowledgeChanges(cart)
    return HttpResponse.json(cartView(cart))
  }),

  http.post('/api/cart/merge', async ({ request }) => {
    const failure = await simulate('cart', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const body = await parseBody(request, z.object({ guestCartId: z.string().min(1) }))
    if ('response' in body) return body.response
    const userCart = getOrCreateCart({ type: 'user', userId: auth.user.id })
    const guest = findCart({ type: 'guest', guestId: body.data.guestCartId })
    if (guest) mergeCarts(guest, userCart)
    return HttpResponse.json(cartView(userCart))
  }),

  http.post('/api/quotes', async ({ request }) => {
    const failure = await simulate('quote', request)
    if (failure) return failure
    const resolved = resolveOwner(request)
    if ('response' in resolved) return resolved.response
    const body = await parseBody(request, z.object({ network: Network.optional() }))
    if ('response' in body) return body.response
    const cart = getOrCreateCart(resolved.owner)
    const {
      cartId: _c,
      userId: _u,
      ...quote
    } = buildQuote(cart, body.data.network ?? 'ethereum', resolved.userId)
    return HttpResponse.json(quote)
  }),
]
