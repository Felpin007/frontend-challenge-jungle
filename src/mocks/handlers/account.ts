import { delay, http, HttpResponse } from 'msw'
import {
  AVATAR_MAX_BYTES,
  AvatarUploadRequest,
  ChangePasswordRequest,
  ConnectWalletRequest,
  ProfileUpdateRequest,
  WalletInput,
  WalletSlot,
  type User,
  type WalletSession,
  type WalletsResponse,
} from '@/api/contracts'
import { hashPassword, randomHex } from '../crypto'
import { db, nextId, nowIso, persist } from '../db'
import { publicUser } from '../domain/sessions'
import { apiError, authenticate, parseBody, simulate } from '../mock-http'
import { getScenario } from '../scenarios'

function walletsOf(userId: string): WalletsResponse {
  const strip = <T extends { userId: string }>(w: T | undefined) => {
    if (!w) return null
    const { userId: _u, ...wallet } = w
    return wallet
  }
  const list = db().wallets.filter((w) => w.userId === userId)
  return {
    primary: strip(list.find((w) => w.slot === 'primary')),
    secondary: strip(list.find((w) => w.slot === 'secondary')),
  }
}

export const accountHandlers = [
  // ------------------------------------------------------------------ Perfil
  http.get('/api/profile', async ({ request }) => {
    const failure = await simulate('profile', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    return HttpResponse.json<User>(publicUser(auth.user))
  }),

  http.patch('/api/profile', async ({ request }) => {
    const failure = await simulate('profile', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const body = await parseBody(request, ProfileUpdateRequest)
    if ('response' in body) return body.response
    const others = db().users.filter((u) => u.id !== auth.user.id)
    if (others.some((u) => u.username === body.data.username)) {
      return apiError(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', {
        fieldErrors: { username: 'Este nome de usuário já está em uso.' },
      })
    }
    if (others.some((u) => u.email === body.data.email)) {
      return apiError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', {
        fieldErrors: { email: 'Este e-mail já está cadastrado.' },
      })
    }
    Object.assign(auth.user, body.data)
    persist()
    return HttpResponse.json<User>(publicUser(auth.user))
  }),

  http.put('/api/profile/avatar', async ({ request }) => {
    const failure = await simulate('profile', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const body = await parseBody(request, AvatarUploadRequest)
    if ('response' in body) return body.response
    // base64 ocupa ~4/3 do tamanho original
    const bytes = Math.floor((body.data.dataUrl.length - body.data.dataUrl.indexOf(',') - 1) * 0.75)
    if (bytes > AVATAR_MAX_BYTES) {
      return apiError(422, 'VALIDATION_ERROR', 'A imagem deve ter no máximo 1 MB.', {
        fieldErrors: { avatar: 'A imagem deve ter no máximo 1 MB.' },
      })
    }
    auth.user.avatarUrl = body.data.dataUrl
    persist()
    return HttpResponse.json<User>(publicUser(auth.user))
  }),

  http.delete('/api/profile/avatar', async ({ request }) => {
    const failure = await simulate('profile', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    auth.user.avatarUrl = null
    persist()
    return HttpResponse.json<User>(publicUser(auth.user))
  }),

  http.post('/api/profile/password', async ({ request }) => {
    const failure = await simulate('profile', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const body = await parseBody(request, ChangePasswordRequest)
    if ('response' in body) return body.response
    const { currentPassword, newPassword } = body.data
    if ((await hashPassword(currentPassword, auth.user.salt)) !== auth.user.passwordHash) {
      return apiError(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', {
        fieldErrors: { currentPassword: 'Senha atual incorreta.' },
      })
    }
    if (currentPassword === newPassword) {
      return apiError(422, 'VALIDATION_ERROR', 'A nova senha deve ser diferente da atual.', {
        fieldErrors: { newPassword: 'A nova senha deve ser diferente da atual.' },
      })
    }
    auth.user.salt = randomHex(16)
    auth.user.passwordHash = await hashPassword(newPassword, auth.user.salt)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // ------------------------------------------------------------- Carteiras
  http.get('/api/wallets', async ({ request }) => {
    const failure = await simulate('wallets', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    return HttpResponse.json(walletsOf(auth.user.id))
  }),

  http.put('/api/wallets/:slot', async ({ request, params }) => {
    const failure = await simulate('wallets', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const slot = WalletSlot.safeParse(params.slot)
    if (!slot.success) return apiError(404, 'NOT_FOUND', 'Carteira inexistente.')
    const body = await parseBody(request, WalletInput)
    if ('response' in body) return body.response
    const wallets = db().wallets
    const existing = wallets.find((w) => w.userId === auth.user.id && w.slot === slot.data)
    if (
      slot.data === 'secondary' &&
      !wallets.some((w) => w.userId === auth.user.id && w.slot === 'primary')
    ) {
      return apiError(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal antes da secundária.')
    }
    if (existing) {
      Object.assign(existing, body.data, { updatedAt: nowIso() })
    } else {
      wallets.push({
        ...body.data,
        id: nextId('wallet'),
        slot: slot.data,
        userId: auth.user.id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
    }
    persist()
    return HttpResponse.json(walletsOf(auth.user.id))
  }),

  http.delete('/api/wallets/secondary', async ({ request }) => {
    const failure = await simulate('wallets', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    db().wallets = db().wallets.filter(
      (w) => !(w.userId === auth.user.id && w.slot === 'secondary'),
    )
    persist()
    return HttpResponse.json(walletsOf(auth.user.id))
  }),

  // --------------------------------------------- Conexão simulada de carteira
  http.get('/api/wallet-sessions', async ({ request }) => {
    const failure = await simulate('wallets', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const items = db()
      .walletSessions.filter((s) => s.userId === auth.user.id && s.status === 'connected')
      .map(({ userId: _u, ...s }) => s)
    return HttpResponse.json({ items })
  }),

  http.post('/api/wallet-sessions', async ({ request }) => {
    const failure = await simulate('wallets', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const body = await parseBody(request, ConnectWalletRequest)
    if ('response' in body) return body.response
    const wallet = db().wallets.find(
      (w) => w.id === body.data.walletId && w.userId === auth.user.id,
    )
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    // Simula o tempo de aprovação na extensão da carteira
    await delay(getScenario().latency === 'none' ? 0 : 800)
    if (getScenario().wallet === 'reject') {
      return apiError(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    }
    const sessions = db().walletSessions
    for (const s of sessions) if (s.userId === auth.user.id) s.status = 'disconnected'
    const session: WalletSession & { userId: string } = {
      id: nextId('wsession'),
      walletId: wallet.id,
      provider: body.data.provider,
      network: body.data.network,
      address: wallet.address,
      status: 'connected',
      connectedAt: nowIso(),
      userId: auth.user.id,
    }
    db().walletSessions = [
      ...sessions.filter((s) => s.status === 'connected' || s.userId !== auth.user.id).slice(-50),
      session,
    ]
    persist()
    const { userId: _u, ...response } = session
    return HttpResponse.json<WalletSession>(response, { status: 201 })
  }),

  http.delete('/api/wallet-sessions/:id', async ({ request, params }) => {
    const failure = await simulate('wallets', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const session = db().walletSessions.find((s) => s.id === params.id && s.userId === auth.user.id)
    if (!session) return apiError(404, 'NOT_FOUND', 'Conexão não encontrada.')
    session.status = 'disconnected'
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
