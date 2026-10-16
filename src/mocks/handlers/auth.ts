import { http, HttpResponse } from 'msw'
import { LoginRequest, RegisterRequest, type Session, type SessionInfo } from '@/api/contracts'
import { hashPassword, randomHex } from '../crypto'
import { db, nextId, nowIso, persist } from '../db'
import { createSession, endSession, publicUser, resolveSession } from '../domain/sessions'
import { apiError, authenticate, bearerToken, parseBody, simulate } from '../mock-http'

export const authHandlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const failure = await simulate('auth', request)
    if (failure) return failure
    const body = await parseBody(request, RegisterRequest)
    if ('response' in body) return body.response
    const { username, email, password } = body.data
    const users = db().users
    if (users.some((u) => u.email === email)) {
      return apiError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', {
        fieldErrors: { email: 'Este e-mail já está cadastrado.' },
      })
    }
    if (users.some((u) => u.username === username)) {
      return apiError(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', {
        fieldErrors: { username: 'Este nome de usuário já está em uso.' },
      })
    }
    const salt = randomHex(16)
    const user = {
      id: nextId('user'),
      email,
      username,
      displayName: username,
      avatarUrl: null,
      ensName: null,
      walletNickname: null,
      createdAt: nowIso(),
      salt,
      passwordHash: await hashPassword(password, salt),
    }
    users.push(user)
    db().favorites[user.id] = []
    persist()
    const session = createSession(user.id)
    return HttpResponse.json<Session>({ ...session, user: publicUser(user) }, { status: 201 })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const failure = await simulate('auth', request)
    if (failure) return failure
    const body = await parseBody(request, LoginRequest)
    if ('response' in body) return body.response
    const user = db().users.find((u) => u.email === body.data.email)
    // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
    if (!user || (await hashPassword(body.data.password, user.salt)) !== user.passwordHash) {
      return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    }
    const session = createSession(user.id)
    return HttpResponse.json<Session>({ ...session, user: publicUser(user) })
  }),

  http.get('/api/auth/session', async ({ request }) => {
    const failure = await simulate('auth', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const resolved = resolveSession(auth.token)
    if (!resolved || resolved === 'expired')
      return apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou.')
    return HttpResponse.json<SessionInfo>({
      expiresAt: resolved.expiresAt,
      user: publicUser(auth.user),
    })
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    const failure = await simulate('auth', request)
    if (failure) return failure
    const token = bearerToken(request)
    if (token) endSession(token)
    return new HttpResponse(null, { status: 204 })
  }),
]
