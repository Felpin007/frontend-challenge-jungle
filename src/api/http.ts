import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { config } from '@/config'
import { sessionStore } from '@/features/auth/session-store'
import { ApiErrorBody, type ErrorCode } from './contracts'

/**
 * Erro normalizado: toda falha (HTTP, rede, timeout, contrato inválido) vira
 * um ApiError com `code`, para a interface decidir o feedback sem conhecer o Axios.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED' | 'CONTRACT_ERROR',
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Falhas transitórias: vale a pena tentar de novo automaticamente. */
  get isTransient() {
    return (
      this.code === 'NETWORK_ERROR' ||
      this.code === 'TIMEOUT' ||
      this.code === 'SERVICE_UNAVAILABLE' ||
      this.status >= 500
    )
  }
}

const GUEST_CART_KEY = 'kurio:guest-cart-id'

export function getGuestCartId(): string {
  try {
    let id = localStorage.getItem(GUEST_CART_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(GUEST_CART_KEY, id)
    }
    return id
  } catch {
    return 'guest-no-storage'
  }
}

export function resetGuestCartId() {
  try {
    localStorage.removeItem(GUEST_CART_KEY)
  } catch {
    // ignorado
  }
}

export const http = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((request) => {
  const session = sessionStore.get()
  if (session) request.headers.set('Authorization', `Bearer ${session.token}`)
  request.headers.set('X-Cart-Id', getGuestCartId())
  return request
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error)
    // Sessão expirada/inválida em qualquer chamada: encerra a sessão local.
    // O AuthWatcher reage limpando o cache privado e redirecionando ao login.
    const sentToken = error instanceof AxiosError && error.config?.headers?.Authorization
    if (sentToken && (apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED')) {
      sessionStore.clear('expired')
    }
    return Promise.reject(apiError)
  },
)

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError(0, 'CANCELED', 'Requisição cancelada')
  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError(0, 'TIMEOUT', 'O servidor demorou para responder.')
    }
    if (!error.response) {
      return new ApiError(0, 'NETWORK_ERROR', 'Sem conexão com o servidor. Verifique sua internet.')
    }
    const parsed = ApiErrorBody.safeParse(error.response.data)
    if (parsed.success) {
      const { code, message, fieldErrors, details } = parsed.data.error
      return new ApiError(error.response.status, code, message, fieldErrors, details)
    }
    return new ApiError(error.response.status, 'INTERNAL_ERROR', 'Erro inesperado do servidor.')
  }
  return new ApiError(
    0,
    'INTERNAL_ERROR',
    error instanceof Error ? error.message : 'Erro inesperado',
  )
}

/**
 * Executa a requisição e valida a resposta com o schema do contrato.
 * Uma resposta fora do contrato vira erro aqui, na fronteira de transporte.
 */
export async function request<T extends z.ZodType>(
  schema: T,
  options: AxiosRequestConfig,
): Promise<z.infer<T>> {
  const response = await http.request(options)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    console.error('Resposta fora do contrato', options.url, parsed.error.issues)
    throw new ApiError(response.status, 'CONTRACT_ERROR', 'Resposta inválida do servidor.')
  }
  return parsed.data
}

export async function requestVoid(options: AxiosRequestConfig): Promise<void> {
  await http.request(options)
}
