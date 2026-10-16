import type { Network, NftListQuery } from './contracts'

/**
 * Chaves do TanStack Query. Dados privados ficam sempre sob o id do usuário
 * (`['user', userId, ...]`) ou do dono do carrinho; assim o cache de um usuário
 * nunca é reaproveitado por outro e o logout limpa tudo com um único prefixo.
 */
export type CartOwnerKey = `user:${string}` | `guest:${string}`

export const queryKeys = {
  session: (token: string) => ['session', token] as const,

  nfts: {
    all: ['nfts'] as const,
    lists: ['nfts', 'list'] as const,
    list: (query: NftListQuery) => ['nfts', 'list', query] as const,
    featured: ['nfts', 'featured'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },

  cart: {
    all: ['cart'] as const,
    byOwner: (owner: CartOwnerKey) => ['cart', owner] as const,
    quote: (owner: CartOwnerKey, network: Network) => ['cart', owner, 'quote', network] as const,
  },

  user: {
    all: ['user'] as const,
    scope: (userId: string) => ['user', userId] as const,
    favorites: (userId: string) => ['user', userId, 'favorites'] as const,
    favoriteItems: (userId: string) => ['user', userId, 'favorites', 'items'] as const,
    profile: (userId: string) => ['user', userId, 'profile'] as const,
    wallets: (userId: string) => ['user', userId, 'wallets'] as const,
    walletSessions: (userId: string) => ['user', userId, 'wallet-sessions'] as const,
    orders: (userId: string) => ['user', userId, 'orders'] as const,
    pendingOrders: (userId: string) => ['user', userId, 'orders', 'list', 'pending'] as const,
    order: (userId: string, orderId: string) =>
      ['user', userId, 'orders', 'detail', orderId] as const,
  },
}
