/**
 * Servidor Socket.IO simulado com MSW.
 *
 * O MSW intercepta a conexão WebSocket aberta pelo `socket.io-client` e o
 * `@mswjs/socket.io-binding` traduz o protocolo Engine.IO/Socket.IO (handshake
 * e pacotes "42[...]") para eventos. Complementamos o binding com:
 *  - heartbeat: no Engine.IO v4 o servidor envia ping ("2"); sem isso o cliente
 *    desconecta por "ping timeout" a cada ~30 s;
 *  - autenticação: lemos o pacote CONNECT ("40{...}") para saber o usuário;
 *  - roteamento por usuário: `order.updated` só vai para as conexões do dono.
 */
import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftDetail, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { REALTIME_EVENTS } from '@/api/contracts'
import { config } from '@/config'
import { db, persist } from './db'
import { subscribe } from './domain/bus'
import { resolveSession } from './domain/sessions'

const HEARTBEAT_MS = 20_000

type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

interface Connection {
  id: number
  close: (code?: number, reason?: string) => void
  sendRaw: (data: string) => void
  emit: (event: string, payload: unknown) => void
  token: string | null
  userId: string | null
}

const connections = new Map<number, Connection>()
const history: Array<{ event: RealtimeEvent; userId: string | null }> = []
let connectionSeq = 0
let outageUntil = 0

// O MSW remove o prefixo "/socket.io/" do caminho antes de comparar a URL,
// então o link é registrado na raiz do host.
const realtime = ws.link(config.realtimeUrl)

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const { client } = connection
    if (Date.now() < outageUntil) {
      // Durante a "queda", recusa novas conexões; o cliente tenta de novo com backoff.
      client.close(4000, 'Servidor indisponível (simulado)')
      return
    }
    const io = toSocketIo(connection)
    const conn: Connection = {
      id: ++connectionSeq,
      close: (code, reason) => client.close(code, reason),
      sendRaw: (data) => client.send(data),
      emit: (event, payload) => io.client.emit(event, payload),
      token: null,
      userId: null,
    }
    connections.set(conn.id, conn)

    client.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || !event.data.startsWith('40')) return
      const auth =
        event.data.length > 2 ? (JSON.parse(event.data.slice(2)) as { token?: string }) : {}
      const session = auth.token ? resolveSession(auth.token) : null
      conn.token = auth.token ?? null
      conn.userId = session && session !== 'expired' ? session.user.id : null
    })

    const heartbeat = setInterval(() => client.send('2'), HEARTBEAT_MS)
    client.addEventListener('close', () => {
      clearInterval(heartbeat)
      connections.delete(conn.id)
    })
  }),
]

function nextEventId() {
  const state = db()
  state.eventSeq += 1
  persist()
  return `evt-${state.eventSeq}`
}

function deliver(event: RealtimeEvent, userId: string | null) {
  history.push({ event, userId })
  if (history.length > 200) history.shift()
  for (const conn of connections.values()) {
    if (userId && conn.userId !== userId) continue
    conn.emit(event.type, event)
  }
}

export function buildNftEvent(nft: NftDetail): NftUpdatedEvent {
  return {
    eventId: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      nftId: nft.id,
      price: nft.price,
      totalAvailable: nft.totalAvailable,
      editions: nft.editions.map(({ id, price, available }) => ({ id, price, available })),
    },
  }
}

function buildOrderEvent(order: Order): OrderUpdatedEvent {
  return {
    eventId: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    data: { orderId: order.id, userId: order.userId, status: order.status, order },
  }
}

export function startRealtimeBridge() {
  subscribe('nft.changed', (nft) => deliver(buildNftEvent(nft), null))
  subscribe('order.changed', (order) => deliver(buildOrderEvent(order), order.userId))
  subscribe('session.ended', ({ token }) => {
    for (const conn of connections.values()) {
      if (conn.token !== token) continue
      // Pacote DISCONNECT do Socket.IO: o cliente não tenta reconectar sozinho.
      conn.sendRaw('41')
      conn.close(1000, 'Sessão encerrada')
    }
  })
}

// ---------------------------------------------------------------------------
// Controles usados pelo painel de cenários e pelos testes
// ---------------------------------------------------------------------------

/** Derruba as conexões e recusa novas durante `outageMs`. */
export function dropConnections(outageMs = 0) {
  outageUntil = Date.now() + outageMs
  for (const conn of connections.values()) conn.close(4001, 'Conexão interrompida (simulado)')
}

/** Reenvia o último evento (mesmo eventId), simulando entrega duplicada. */
export function replayLastEvent(type?: RealtimeEvent['type']) {
  const last = [...history].reverse().find((h) => !type || h.event.type === type)
  if (!last) return false
  for (const conn of connections.values()) {
    if (last.userId && conn.userId !== last.userId) continue
    conn.emit(last.event.type, last.event)
  }
  return true
}

/** Envia um nft.updated com versão antiga e preço diferente: o cliente deve ignorar. */
export function sendStaleNftEvent(nftId: string) {
  const nft = db().nfts.find((n) => n.id === nftId)
  if (!nft) return false
  const stale = buildNftEvent(nft)
  stale.version = Math.max(0, nft.version - 1)
  stale.data = {
    ...stale.data,
    price: '99.99',
    editions: stale.data.editions.map((e) => ({ ...e, price: '99.99' })),
  }
  for (const conn of connections.values()) conn.emit(REALTIME_EVENTS.nftUpdated, stale)
  return true
}

export function connectionCount() {
  return connections.size
}

/** Usuário de cada conexão aberta (null = visitante). Usado para verificar isolamento. */
export function connectedUsers() {
  return [...connections.values()].map((c) => c.userId)
}
