import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { Quote, type CreateOrderRequest, type Order } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import { ApiError } from '@/api/http'
import { queryKeys } from '@/api/query-keys'

/**
 * Envio do pedido com idempotência.
 *
 * - Cada confirmação do usuário gera UMA chave (Idempotency-Key). A tentativa
 *   (chave + corpo) é salva no localStorage antes do envio.
 * - Timeout ou erro de rede: repetimos com a MESMA chave; o servidor devolve o
 *   mesmo pedido em vez de criar outro.
 * - Cliques repetidos são ignorados enquanto há envio em andamento.
 * - Após refresh, `resume()` reenvia a tentativa salva (mesma chave) para
 *   recuperar o pedido, sem duplicar a compra.
 */
export interface PendingAttempt {
  key: string
  body: CreateOrderRequest
  createdAt: number
}

const MAX_RETRIES = 3
const storageKey = (userId: string) => `kurio:checkout-attempt:${userId}`

export function loadAttempt(userId: string): PendingAttempt | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as PendingAttempt) : null
  } catch {
    return null
  }
}

function saveAttempt(userId: string, attempt: PendingAttempt | null) {
  try {
    if (attempt) localStorage.setItem(storageKey(userId), JSON.stringify(attempt))
    else localStorage.removeItem(storageKey(userId))
  } catch {
    // sem storage: a recuperação após refresh fica indisponível, o resto funciona
  }
}

export type PlaceOrderState =
  | { status: 'idle' }
  | { status: 'submitting'; attempt: number }
  | { status: 'recovering'; attempt: number }
  | { status: 'outdated'; quote: Quote; message: string }
  | { status: 'error'; error: ApiError }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function usePlaceOrder(userId: string, onCreated: (order: Order) => void) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<PlaceOrderState>({ status: 'idle' })
  const inFlight = useRef(false)

  const send = useCallback(
    async (attempt: PendingAttempt, recovering: boolean) => {
      if (inFlight.current) return
      inFlight.current = true
      saveAttempt(userId, attempt)
      try {
        for (let i = 0; i <= MAX_RETRIES; i++) {
          setState({ status: recovering || i > 0 ? 'recovering' : 'submitting', attempt: i })
          try {
            const order = await ordersApi.create(attempt.body, attempt.key)
            saveAttempt(userId, null)
            queryClient.setQueryData(queryKeys.user.order(userId, order.id), order)
            setState({ status: 'idle' })
            onCreated(order)
            return
          } catch (error) {
            const apiError =
              error instanceof ApiError
                ? error
                : new ApiError(0, 'INTERNAL_ERROR', 'Erro inesperado')
            const retryable =
              apiError.code === 'TIMEOUT' ||
              apiError.code === 'NETWORK_ERROR' ||
              apiError.status >= 500
            if (retryable && i < MAX_RETRIES) {
              await wait(800 * 2 ** i)
              continue
            }
            if (!retryable) saveAttempt(userId, null)
            if (apiError.code === 'QUOTE_OUTDATED' || apiError.code === 'AVAILABILITY_CONFLICT') {
              const parsed = Quote.safeParse(
                (apiError.details as { quote?: unknown } | undefined)?.quote,
              )
              void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all })
              if (parsed.success) {
                setState({ status: 'outdated', quote: parsed.data, message: apiError.message })
                return
              }
            }
            setState({ status: 'error', error: apiError })
            return
          }
        }
      } finally {
        inFlight.current = false
      }
    },
    [onCreated, queryClient, userId],
  )

  const submit = useCallback(
    (body: CreateOrderRequest) =>
      send({ key: crypto.randomUUID(), body, createdAt: Date.now() }, false),
    [send],
  )

  const resume = useCallback(() => {
    const attempt = loadAttempt(userId)
    if (attempt) void send(attempt, true)
    return Boolean(attempt)
  }, [send, userId])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return {
    state,
    submit,
    resume,
    reset,
    busy: state.status === 'submitting' || state.status === 'recovering',
  }
}
