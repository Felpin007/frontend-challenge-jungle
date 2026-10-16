/**
 * Barramento interno do servidor simulado. As regras de negócio publicam
 * mudanças aqui e o módulo de tempo real as transforma em eventos Socket.IO.
 * Assim, toda mudança no banco gera o evento correspondente, venha ela de uma
 * requisição REST, de um timer ou do painel de cenários.
 */
import type { NftDetail, Order } from '@/api/contracts'

type BusEvents = {
  'nft.changed': NftDetail
  'order.changed': Order
  'session.ended': { token: string }
}

const listeners = new Map<keyof BusEvents, Set<(payload: never) => void>>()

export function publish<K extends keyof BusEvents>(event: K, payload: BusEvents[K]) {
  listeners.get(event)?.forEach((listener) => (listener as (p: BusEvents[K]) => void)(payload))
}

export function subscribe<K extends keyof BusEvents>(
  event: K,
  listener: (payload: BusEvents[K]) => void,
) {
  const set = listeners.get(event) ?? new Set()
  set.add(listener)
  listeners.set(event, set)
  return () => set.delete(listener)
}
