/**
 * Service worker dos mocks.
 *
 * Reaproveita o worker oficial do MSW (mockServiceWorker.js, gerado pelo pacote)
 * e cobre um caso que ele não trata: o navegador encerra service workers ociosos
 * (por exemplo, com a aba em segundo plano). Ao reiniciar, o MSW perde a lista
 * em memória das abas com os mocks ativos (`activeClientIds`) e passa a mandar
 * /api/* direto para a rede, onde não existe backend (404 no deploy).
 *
 * Aqui essa lista também fica no Cache Storage: é gravada quando a aba ativa os
 * mocks (MOCK_ACTIVATE), apagada quando ela fecha (CLIENT_CLOSED) e restaurada
 * quando o worker reinicia. Uma aba que nunca ativou os mocks continua indo
 * para a rede normalmente.
 */
importScripts('./mockServiceWorker.js')

const STORE = 'kurio-msw'
const ACTIVE_CLIENTS_KEY = '/__kurio/active-clients'

async function readActiveClients() {
  try {
    const cache = await caches.open(STORE)
    const response = await cache.match(ACTIVE_CLIENTS_KEY)
    return response ? await response.json() : []
  } catch {
    return []
  }
}

// Gravações em fila: MOCK_ACTIVATE e CLIENT_CLOSED podem chegar juntos (refresh).
let writes = Promise.resolve()
function updateActiveClients(change) {
  writes = writes.then(async () => {
    try {
      const cache = await caches.open(STORE)
      const next = change(await readActiveClients())
      await cache.put(ACTIVE_CLIENTS_KEY, new Response(JSON.stringify(next)))
    } catch {
      // Cache Storage indisponível: vale só a lista em memória do MSW
    }
  })
  return writes
}

self.addEventListener('message', (event) => {
  const clientId = event.source && event.source.id
  if (!clientId) return
  if (event.data === 'MOCK_ACTIVATE') {
    event.waitUntil(updateActiveClients((ids) => [...new Set([...ids, clientId])]))
  } else if (event.data === 'CLIENT_CLOSED') {
    event.waitUntil(updateActiveClients((ids) => ids.filter((id) => id !== clientId)))
  }
})

/** Restaura as abas ativas que ainda existem (executa a cada início do worker). */
const restored = (async () => {
  const saved = await readActiveClients()
  const alive = []
  for (const id of saved) {
    if (await self.clients.get(id)) alive.push(id)
  }
  for (const id of alive) activeClientIds.add(id)
  if (alive.length !== saved.length) await updateActiveClients(() => alive)
})()

self.addEventListener('fetch', (event) => {
  // O listener do MSW (registrado antes, pelo importScripts) só deixa de responder
  // quando não há nenhuma aba ativa em memória: é o caso do worker recém-reiniciado.
  if (activeClientIds.size > 0 || event.request.mode === 'navigate') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/api/')) return
  event.respondWith(
    restored.then(() =>
      activeClientIds.has(event.clientId)
        ? handleRequest(event, crypto.randomUUID(), Date.now())
        : fetch(event.request),
    ),
  )
})
