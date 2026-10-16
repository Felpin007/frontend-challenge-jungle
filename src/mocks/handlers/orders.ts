import { delay, http, HttpResponse } from 'msw'
import { CreateOrderRequest, type Order } from '@/api/contracts'
import { db } from '../db'
import { createOrder, findOrder, resolveIfDue, toOrder } from '../domain/orders'
import { apiError, authenticate, parseBody, simulate } from '../mock-http'
import { getScenario } from '../scenarios'

/** Maior que o timeout do cliente para criação de pedido (CREATE_ORDER_TIMEOUT_MS em src/api/endpoints.ts). */
export const ORDER_TIMEOUT_DELAY_MS = 15_000

export const orderHandlers = [
  http.post('/api/orders', async ({ request }) => {
    const failure = await simulate('orders', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const key = request.headers.get('idempotency-key')
    if (!key || key.length < 8) {
      return apiError(422, 'VALIDATION_ERROR', 'Header Idempotency-Key obrigatório.')
    }
    const body = await parseBody(request, CreateOrderRequest)
    if ('response' in body) return body.response

    const result = createOrder(auth.user.id, key, body.data)
    if (result.kind === 'error') {
      return apiError(result.status, result.code, result.message, { details: result.details })
    }
    if (result.kind === 'created' && getScenario().orderTimeout) {
      // O pedido JÁ foi criado; só a resposta demora. O cliente desiste (timeout)
      // e, ao repetir com a mesma chave, recebe este mesmo pedido.
      await delay(ORDER_TIMEOUT_DELAY_MS)
    }
    return HttpResponse.json<Order>(toOrder(result.order), {
      status: result.kind === 'created' ? 201 : 200,
      headers: { 'Idempotent-Replayed': String(result.kind === 'replayed') },
    })
  }),

  http.get('/api/orders', async ({ request }) => {
    const failure = await simulate('orders', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const status = new URL(request.url).searchParams.get('status')
    const items = db()
      .orders.filter((o) => o.userId === auth.user.id)
      .map((o) => resolveIfDue(o))
      .filter((o) => !status || o.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toOrder)
    return HttpResponse.json({ items })
  }),

  http.get('/api/orders/:id', async ({ request, params }) => {
    const failure = await simulate('orders', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const order = findOrder(auth.user.id, String(params.id))
    if (order === 'forbidden')
      return apiError(403, 'FORBIDDEN', 'Este pedido pertence a outro usuário.')
    if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    return HttpResponse.json<Order>(toOrder(order))
  }),
]
