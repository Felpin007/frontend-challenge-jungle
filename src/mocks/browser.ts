import { setupWorker } from 'msw/browser'
import { mockControl } from './control'
import { initDb } from './db'
import { resumePendingOrders } from './domain/orders'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { nftHandlers } from './handlers/nfts'
import { orderHandlers } from './handlers/orders'
import { realtimeHandlers, startRealtimeBridge } from './realtime'
import { loadScenario } from './scenarios'

export const handlers = [
  ...authHandlers,
  ...nftHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  ...realtimeHandlers,
]

/**
 * Inicia o "servidor" simulado: carrega cenário e banco, liga o barramento de
 * eventos ao Socket.IO e registra o service worker do MSW. O app só é
 * renderizado depois disso, para que nenhuma requisição escape dos mocks.
 */
export async function startMocks() {
  loadScenario()
  await initDb()
  startRealtimeBridge()
  resumePendingOrders()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  window.__kurioMocks = mockControl
}
