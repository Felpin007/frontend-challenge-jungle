/**
 * API de controle do servidor simulado, exposta em `window.__kurioMocks`.
 * Usada pelo painel de cenários e pelos testes Playwright para disparar
 * mudanças "do lado do servidor". O app nunca chama estas funções: ele só
 * percebe os efeitos pelas respostas REST e pelos eventos do Socket.IO.
 */
import { db, resetDb } from './db'
import { findEdition, updateEditions } from './domain/catalog'
import { resolveIfDue } from './domain/orders'
import { expireAllSessions } from './domain/sessions'
import { clearInjected, delayNext, failNext } from './mock-http'
import {
  connectedUsers,
  connectionCount,
  dropConnections,
  replayLastEvent,
  sendStaleNftEvent,
} from './realtime'
import { getScenario, PRESETS, setScenario } from './scenarios'

export const mockControl = {
  presets: PRESETS,
  getScenario,
  setScenario,
  failNext,
  delayNext,

  /** Restaura o seed, limpa falhas injetadas e recarrega a página. */
  async reset({ reload = true } = {}) {
    await resetDb()
    clearInjected()
    if (reload) window.location.reload()
  },

  expireSessions: expireAllSessions,

  /** Muda o preço de uma edição (ou de todas, se `editionId` for omitido). */
  changePrice(nftId: string, price: string, editionId?: string) {
    const nft = db().nfts.find((n) => n.id === nftId)
    if (!nft) throw new Error(`NFT ${nftId} não existe`)
    const targets = editionId ? [editionId] : nft.editions.map((e) => e.id)
    return updateEditions(
      nftId,
      targets.map((id) => ({ editionId: id, price })),
    )
  },

  setAvailability(nftId: string, editionId: string, available: number) {
    if (!findEdition(nftId, editionId)) throw new Error(`Edição ${editionId} não existe`)
    return updateEditions(nftId, [{ editionId, available }])
  },

  dropRealtime: dropConnections,
  replayLastEvent,
  sendStaleNftEvent,
  connectionCount,
  connectedUsers,

  /** Resolve agora todos os pedidos pendentes (confirmando ou recusando conforme o cenário). */
  resolvePendingOrders() {
    for (const order of db().orders) if (order.status === 'pending') resolveIfDue(order, true)
  },

  snapshot: () => structuredClone(db()),
}

export type MockControl = typeof mockControl

declare global {
  interface Window {
    __kurioMocks?: MockControl
  }
}
