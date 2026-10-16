import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { NftUpdatedEvent, OrderUpdatedEvent, REALTIME_EVENTS, type Cart } from '@/api/contracts'
import { queryKeys } from '@/api/query-keys'
import { config } from '@/config'
import { useStoredSession } from '@/features/auth/session-store'
import { formatEth } from '@/lib/money'
import { applyNftUpdated, applyOrderUpdated } from './apply-events'
import { EventGuard } from './event-guard'
import { realtimeStatus } from './status-store'

/**
 * Mantém uma conexão Socket.IO por sessão. Quando o usuário troca (login,
 * logout, expiração), o efeito é refeito: a conexão anterior é encerrada e
 * seus listeners removidos, então eventos da sessão antiga não chegam à nova.
 */
export function RealtimeProvider() {
  const queryClient = useQueryClient()
  const session = useStoredSession()
  const token = session?.token ?? null
  const userId = session?.userId ?? null

  useEffect(() => {
    let socket: Socket | null = null
    let disposed = false
    realtimeStatus.set('connecting')

    // Import dinâmico de propósito: o engine.io-client guarda `globalThis.WebSocket`
    // quando o módulo é avaliado. Carregando-o só aqui (depois do MSW iniciar),
    // ele recebe o WebSocket já interceptado. Bônus: sai do bundle inicial.
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      socket = io(config.realtimeUrl, {
        transports: ['websocket'], // o MSW intercepta WebSocket, não long-polling
        auth: token ? { token } : {},
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
        timeout: 5000,
      })
      registerHandlers(socket)
    })

    function registerHandlers(socket: Socket) {
      const guard = new EventGuard()

      socket.on('connect', () => {
        realtimeStatus.set('connected')
        // A cada conexão (inclusive a primeira) eventos podem ter sido perdidos:
        // entre o carregamento via REST e o socket conectar, ou durante uma queda.
        // Reconcilia com a API os recursos que estão na tela.
        const active = { refetchType: 'active' } as const
        void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all, ...active })
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all, ...active })
        if (userId) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.user.orders(userId), ...active })
        }
      })
      socket.on('disconnect', (reason) => {
        // "io client disconnect" = fechamos de propósito (troca de sessão)
        if (reason !== 'io client disconnect') realtimeStatus.set('reconnecting')
      })
      socket.io.on('reconnect_attempt', () => realtimeStatus.set('reconnecting'))

      socket.on(REALTIME_EVENTS.nftUpdated, (payload: unknown) => {
        const parsed = NftUpdatedEvent.safeParse(payload)
        if (!parsed.success || !guard.accept(parsed.data)) return
        announceCartChange(parsed.data)
        applyNftUpdated(queryClient, parsed.data)
      })

      socket.on(REALTIME_EVENTS.orderUpdated, (payload: unknown) => {
        const parsed = OrderUpdatedEvent.safeParse(payload)
        if (!parsed.success || !userId || !guard.accept(parsed.data)) return
        applyOrderUpdated(queryClient, parsed.data, userId)
      })
    }

    function announceCartChange(event: NftUpdatedEvent) {
      const carts = queryClient.getQueriesData<Cart>({ queryKey: queryKeys.cart.all })
      for (const [, cart] of carts) {
        if (!cart || !('items' in cart)) continue
        for (const item of cart.items) {
          if (item.nftId !== event.data.nftId) continue
          const edition = event.data.editions.find((e) => e.id === item.editionId)
          if (!edition) continue
          if (edition.available === 0) {
            toast.warning(`${item.name} (${item.editionLabel}) esgotou e foi marcado no carrinho.`)
          } else if (edition.available < item.quantity) {
            toast.warning(`${item.name}: restam apenas ${edition.available} unidade(s).`)
          } else if (edition.price !== item.unitPrice) {
            toast.info(
              `Preço de ${item.name} mudou: ${formatEth(item.unitPrice)} → ${formatEth(edition.price)}.`,
            )
          }
          return
        }
      }
    }

    return () => {
      disposed = true
      if (socket) {
        socket.removeAllListeners()
        socket.io.removeAllListeners()
        socket.disconnect()
      }
      realtimeStatus.set('idle')
    }
  }, [queryClient, token, userId])

  return null
}
