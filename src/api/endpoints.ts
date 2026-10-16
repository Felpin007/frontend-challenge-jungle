/**
 * Funções de acesso à API REST. Cada uma declara o contrato da resposta,
 * recebe o AbortSignal do TanStack Query (cancelamento de requisições
 * obsoletas) e devolve dados já validados.
 */
import { z } from 'zod'
import {
  Cart,
  FavoritesResponse,
  FeaturedResponse,
  NftDetail,
  NftListResponse,
  NftSummary,
  Order,
  OrdersResponse,
  Quote,
  Session,
  SessionInfo,
  User,
  WalletSession,
  WalletsResponse,
  type AddCartItemRequest,
  type ChangePasswordRequest,
  type ConnectWalletRequest,
  type CreateOrderRequest,
  type LoginRequest,
  type Network,
  type NftListQuery,
  type ProfileUpdateRequest,
  type RegisterRequest,
  type WalletInput,
  type WalletSlot,
} from './contracts'
import { request, requestVoid } from './http'

type Signal = { signal?: AbortSignal }

export const authApi = {
  register: (body: RegisterRequest) =>
    request(Session, { method: 'POST', url: '/auth/register', data: body }),
  login: (body: LoginRequest) =>
    request(Session, { method: 'POST', url: '/auth/login', data: body }),
  session: ({ signal }: Signal = {}) => request(SessionInfo, { url: '/auth/session', signal }),
  logout: () => requestVoid({ method: 'POST', url: '/auth/logout' }),
}

function listParams(query: NftListQuery) {
  return {
    q: query.q || undefined,
    categories: query.categories?.length ? query.categories.join(',') : undefined,
    networks: query.networks?.length ? query.networks.join(',') : undefined,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    tab: query.tab,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export const nftApi = {
  list: (query: NftListQuery, { signal }: Signal = {}) =>
    request(NftListResponse, { url: '/nfts', params: listParams(query), signal }),
  featured: ({ signal }: Signal = {}) =>
    request(FeaturedResponse, { url: '/nfts/featured', signal }),
  detail: (id: string, { signal }: Signal = {}) =>
    request(NftDetail, { url: `/nfts/${encodeURIComponent(id)}`, signal }),
}

export const favoritesApi = {
  list: ({ signal }: Signal = {}) => request(FavoritesResponse, { url: '/favorites', signal }),
  items: ({ signal }: Signal = {}) =>
    request(z.object({ items: z.array(NftSummary) }), { url: '/favorites/items', signal }),
  add: (nftId: string) =>
    request(FavoritesResponse, { method: 'PUT', url: `/favorites/${encodeURIComponent(nftId)}` }),
  remove: (nftId: string) =>
    request(FavoritesResponse, {
      method: 'DELETE',
      url: `/favorites/${encodeURIComponent(nftId)}`,
    }),
}

export const cartApi = {
  get: ({ signal }: Signal = {}) => request(Cart, { url: '/cart', signal }),
  addItem: (body: AddCartItemRequest) =>
    request(Cart, { method: 'POST', url: '/cart/items', data: body }),
  updateItem: (itemId: string, quantity: number) =>
    request(Cart, {
      method: 'PATCH',
      url: `/cart/items/${encodeURIComponent(itemId)}`,
      data: { quantity },
    }),
  removeItem: (itemId: string) =>
    request(Cart, { method: 'DELETE', url: `/cart/items/${encodeURIComponent(itemId)}` }),
  applyCoupon: (code: string) =>
    request(Cart, { method: 'POST', url: '/cart/coupon', data: { code } }),
  removeCoupon: () => request(Cart, { method: 'DELETE', url: '/cart/coupon' }),
  acknowledge: () => request(Cart, { method: 'POST', url: '/cart/acknowledge' }),
  merge: (guestCartId: string) =>
    request(Cart, { method: 'POST', url: '/cart/merge', data: { guestCartId } }),
  quote: (network: Network, { signal }: Signal = {}) =>
    request(Quote, { method: 'POST', url: '/quotes', data: { network }, signal }),
}

/** Abaixo do atraso do cenário "order-timeout" para que o timeout aconteça de fato. */
export const CREATE_ORDER_TIMEOUT_MS = 8_000

export const ordersApi = {
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    request(Order, {
      method: 'POST',
      url: '/orders',
      data: body,
      headers: { 'Idempotency-Key': idempotencyKey },
      timeout: CREATE_ORDER_TIMEOUT_MS,
    }),
  get: (id: string, { signal }: Signal = {}) =>
    request(Order, { url: `/orders/${encodeURIComponent(id)}`, signal }),
  list: (status?: Order['status'], { signal }: Signal = {}) =>
    request(OrdersResponse, { url: '/orders', params: { status }, signal }),
}

export const profileApi = {
  get: ({ signal }: Signal = {}) => request(User, { url: '/profile', signal }),
  update: (body: ProfileUpdateRequest) =>
    request(User, { method: 'PATCH', url: '/profile', data: body }),
  uploadAvatar: (dataUrl: string) =>
    request(User, { method: 'PUT', url: '/profile/avatar', data: { dataUrl } }),
  removeAvatar: () => request(User, { method: 'DELETE', url: '/profile/avatar' }),
  changePassword: (body: ChangePasswordRequest) =>
    requestVoid({ method: 'POST', url: '/profile/password', data: body }),
}

export const walletsApi = {
  get: ({ signal }: Signal = {}) => request(WalletsResponse, { url: '/wallets', signal }),
  save: (slot: WalletSlot, body: WalletInput) =>
    request(WalletsResponse, { method: 'PUT', url: `/wallets/${slot}`, data: body }),
  removeSecondary: () => request(WalletsResponse, { method: 'DELETE', url: '/wallets/secondary' }),
  sessions: ({ signal }: Signal = {}) =>
    request(z.object({ items: z.array(WalletSession) }), { url: '/wallet-sessions', signal }),
  connect: (body: ConnectWalletRequest) =>
    request(WalletSession, { method: 'POST', url: '/wallet-sessions', data: body }),
  disconnect: (id: string) =>
    requestVoid({ method: 'DELETE', url: `/wallet-sessions/${encodeURIComponent(id)}` }),
}
