import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { Quote, type CreateOrderRequest, type Order } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import { ApiError } from '@/api/http'
import { queryKeys } from '@/api/query-keys'

/**
 * Envio do pedido com idempotência.
 *
 * - Cada confirmação gera UMA chave (Idempotency-Key). A tentativa (chave + corpo)
 *   é salva no localStorage antes do envio.
 * - Timeout ou erro de rede: repetimos com a MESMA chave; o servidor devolve o
 *   mesmo pedido em vez de criar outro.
 * - Se as repetições se esgotarem, a tentativa continua salva: confirmar de novo
 *   com o mesmo conteúdo reaproveita a chave (não há compra duplicada).
 * - Conteúdo diferente gera chave nova. Se a tentativa anterior chegou a criar o
 *   pedido, o servidor responde ORDER_PENDING e o usuário vai para esse pedido.
 * - Cliques repetidos são ignorados enquanto há envio em andamento.
 * - Após refresh, `resume()` reenvia a tentativa salva (mesma chave).
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

/** JSON com chaves ordenadas: o mesmo conteúdo sempre gera o mesmo texto. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export type PlaceOrderState =
  | { status: 'idle' }
  | { status: 'submitting'; attempt: number }
  | { status: 'recovering'; attempt: number }
  | { status: 'outdated'; quote: Quote; message: string }
  | { status: 'error'; error: ApiError }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function usePlaceOrder(
  userId: string,
  onCreated: (order: Order, options: { existing: boolean }) => void,
) {
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
            onCreated(order, { existing: false })
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
              // Já avisa que estamos verificando (a espera antes de repetir faz parte da recuperação).
              setState({ status: 'recovering', attempt: i + 1 })
              await wait(800 * 2 ** i)
              continue
            }
            // Falha transitória esgotada: a tentativa fica salva para reaproveitar a chave.
            if (!retryable) saveAttempt(userId, null)

            if (apiError.code === 'ORDER_PENDING') {
              const orderId = (apiError.details as { orderId?: unknown } | undefined)?.orderId
              if (typeof orderId === 'string') {
                const existing = await ordersApi.get(orderId).catch(() => null)
                if (existing) {
                  queryClient.setQueryData(queryKeys.user.order(userId, existing.id), existing)
                  setState({ status: 'idle' })
                  onCreated(existing, { existing: true })
                  return
                }
              }
            }
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
    (body: CreateOrderRequest) => {
      // Mesma confirmação de antes (ex.: depois de um timeout): reaproveita a chave salva.
      const saved = loadAttempt(userId)
      if (saved && stableJson(saved.body) === stableJson(body)) return send(saved, true)
      return send({ key: crypto.randomUUID(), body, createdAt: Date.now() }, false)
    },
    [send, userId],
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
