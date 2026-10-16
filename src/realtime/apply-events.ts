import type { QueryClient } from '@tanstack/react-query'
import type {
  FeaturedResponse,
  NftDetail,
  NftListResponse,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
} from '@/api/contracts'
import { queryKeys } from '@/api/query-keys'

/**
 * Aplica `nft.updated` no cache: detalhe, listas e destaques são atualizados
 * diretamente (sem nova requisição); carrinho e cotação são invalidados porque
 * subtotal, taxas e status dos itens são calculados pelo servidor.
 */
export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent) {
  const { nftId, price, totalAvailable, editions } = event.data
  const patchSummary = <T extends NftSummary>(item: T): T =>
    item.id === nftId && item.version < event.version
      ? { ...item, price, totalAvailable, version: event.version }
      : item

  queryClient.setQueryData<NftDetail>(queryKeys.nfts.detail(nftId), (old) => {
    if (!old || old.version >= event.version) return old
    return {
      ...patchSummary(old),
      editions: old.editions.map((edition) => {
        const update = editions.find((e) => e.id === edition.id)
        return update ? { ...edition, price: update.price, available: update.available } : edition
      }),
    }
  })

  queryClient.setQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists }, (old) =>
    old ? { ...old, items: old.items.map(patchSummary) } : old,
  )

  queryClient.setQueryData<FeaturedResponse>(queryKeys.nfts.featured, (old) =>
    old ? { hero: old.hero.map(patchSummary), spotlight: patchSummary(old.spotlight) } : old,
  )

  void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all })
}

/**
 * Aplica `order.updated` no cache do pedido, só se o evento for do usuário
 * atual e mais novo que o dado em cache. Estados terminais nunca regridem.
 */
export function applyOrderUpdated(
  queryClient: QueryClient,
  event: OrderUpdatedEvent,
  userId: string,
) {
  if (event.data.userId !== userId) return
  queryClient.setQueryData<Order>(queryKeys.user.order(userId, event.data.orderId), (old) => {
    if (old && (old.version >= event.version || old.status !== 'pending')) return old
    return event.data.order
  })
  void queryClient.invalidateQueries({
    queryKey: queryKeys.user.orders(userId),
    exact: false,
    refetchType: 'active',
  })
  if (event.data.status === 'confirmed') {
    // O servidor removeu do carrinho os itens comprados.
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all })
  }
}
