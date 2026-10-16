import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemRequest, Cart, Network } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { getGuestCartId } from '@/api/http'
import { queryKeys, type CartOwnerKey } from '@/api/query-keys'
import { useStoredSession } from '@/features/auth/session-store'

/** Dono do carrinho: o usuário autenticado ou o visitante (id anônimo no localStorage). */
export function useCartOwner(): CartOwnerKey {
  const session = useStoredSession()
  return session ? `user:${session.userId}` : `guest:${getGuestCartId()}`
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: queryKeys.cart.byOwner(owner),
    queryFn: ({ signal }) => cartApi.get({ signal }),
    staleTime: 10_000,
  })
}

/**
 * Cotação do carrinho calculada pela API (subtotal, desconto, taxa, total).
 * A versão do carrinho faz parte da chave: qualquer mudança no carrinho gera
 * uma nova cotação, e a anterior continua visível enquanto a nova carrega.
 */
export function useQuote(network: Network, cart: Cart | undefined) {
  const owner = useCartOwner()
  return useQuery({
    queryKey: [...queryKeys.cart.quote(owner, network), cart?.version ?? 0],
    queryFn: ({ signal }) => cartApi.quote(network, { signal }),
    enabled: Boolean(cart && cart.items.length > 0),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

function useCartMutation<TVars>(mutationFn: (vars: TVars) => Promise<Cart>) {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn,
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKeys.cart.byOwner(owner), cart)
    },
    onError: () => {
      // Em conflito (ex.: estoque mudou), sincroniza com o estado real do servidor.
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.byOwner(owner) })
    },
  })
}

export const useAddToCart = () =>
  useCartMutation((body: AddCartItemRequest) => cartApi.addItem(body))
export const useUpdateCartItem = () =>
  useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) =>
    cartApi.updateItem(itemId, quantity),
  )
export const useRemoveCartItem = () =>
  useCartMutation((itemId: string) => cartApi.removeItem(itemId))
export const useApplyCoupon = () => useCartMutation((code: string) => cartApi.applyCoupon(code))
export const useRemoveCoupon = () => useCartMutation(() => cartApi.removeCoupon())
export const useAcknowledgeCart = () => useCartMutation(() => cartApi.acknowledge())
