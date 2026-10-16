/**
 * Utilitários compartilhados pelos handlers REST: latência e falhas conforme
 * o cenário, respostas de erro no formato do contrato e autenticação.
 */
import { delay, HttpResponse } from 'msw'
import type { z } from 'zod'
import type { ApiErrorBody, ErrorCode } from '@/api/contracts'
import { getScenario, type FailureGroup } from './scenarios'
import { resolveSession } from './domain/sessions'
import type { UserRecord } from './db'

export function apiError(
  status: number,
  code: ErrorCode,
  message: string,
  extra: Partial<Pick<ApiErrorBody['error'], 'fieldErrors' | 'details'>> = {},
) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, ...extra } }, { status })
}

// ---------------------------------------------------------------------------
// Falhas pontuais (usadas pelos testes e pelo painel de cenários)
// ---------------------------------------------------------------------------

export interface InjectedFailure {
  method: string
  /** Caminho com curingas, ex.: "/api/favorites/*" */
  path: string
  status: number
  code?: ErrorCode
  times: number
  /** Em vez de responder com erro HTTP, simula erro de rede. */
  network?: boolean
}

export interface InjectedDelay {
  method: string
  path: string
  ms: number
  times: number
}

const failures: InjectedFailure[] = []
const delays: InjectedDelay[] = []

export function failNext(failure: Omit<InjectedFailure, 'times'> & { times?: number }) {
  failures.push({ times: 1, ...failure })
}

export function delayNext(entry: Omit<InjectedDelay, 'times'> & { times?: number }) {
  delays.push({ times: 1, ...entry })
}

export function clearInjected() {
  failures.length = 0
  delays.length = 0
}

function globToRegExp(glob: string) {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')
  return new RegExp(`^${escaped}$`)
}

function takeMatching<T extends { method: string; path: string; times: number }>(
  list: T[],
  request: Request,
): T | undefined {
  const { pathname } = new URL(request.url)
  const index = list.findIndex(
    (entry) =>
      (entry.method === '*' || entry.method.toUpperCase() === request.method) &&
      globToRegExp(entry.path).test(pathname),
  )
  if (index === -1) return undefined
  const entry = list[index]
  entry.times -= 1
  if (entry.times <= 0) list.splice(index, 1)
  return entry
}

// ---------------------------------------------------------------------------
// Latência
// ---------------------------------------------------------------------------

let prngState = 42
function nextRandom() {
  // PRNG determinístico: a mesma sequência de requisições gera as mesmas latências
  prngState = (prngState * 1664525 + 1013904223) % 4294967296
  return prngState / 4294967296
}

const OUT_OF_ORDER_CYCLE = [1400, 150, 800, 100]
const outOfOrderCounters = new Map<string, number>()

function latencyFor(group: FailureGroup): number {
  const { latency } = getScenario()
  switch (latency) {
    case 'none':
      return 0
    case 'slow':
      return 2500
    case 'variable':
      return Math.round(100 + nextRandom() * 1900)
    case 'out-of-order': {
      const count = outOfOrderCounters.get(group) ?? 0
      outOfOrderCounters.set(group, count + 1)
      return OUT_OF_ORDER_CYCLE[count % OUT_OF_ORDER_CYCLE.length]
    }
    default:
      return Math.round(150 + nextRandom() * 300)
  }
}

/**
 * Aplica o cenário à requisição. Retorna uma Response quando a requisição
 * deve falhar; `undefined` quando o handler pode seguir normalmente.
 */
export async function simulate(
  group: FailureGroup,
  request: Request,
): Promise<Response | undefined> {
  const scenario = getScenario()
  const injectedDelay = takeMatching(delays, request)
  await delay(injectedDelay ? injectedDelay.ms : latencyFor(group))

  const injected = takeMatching(failures, request)
  if (injected) {
    if (injected.network) return HttpResponse.error()
    return apiError(
      injected.status,
      injected.code ?? 'INTERNAL_ERROR',
      'Falha simulada pelo cenário de teste',
    )
  }
  if (scenario.offline) return HttpResponse.error()
  if (scenario.unavailable.includes(group)) {
    return apiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Serviço temporariamente indisponível. Tente novamente.',
    )
  }
  if (scenario.serverError.includes(group)) {
    return apiError(500, 'INTERNAL_ERROR', 'Erro interno do servidor.')
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Autenticação e validação
// ---------------------------------------------------------------------------

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

export function guestCartId(request: Request): string | null {
  return request.headers.get('x-cart-id')
}

type AuthResult = { user: UserRecord; token: string } | { response: Response }

export function authenticate(request: Request): AuthResult {
  const token = bearerToken(request)
  if (!token) return { response: apiError(401, 'UNAUTHENTICATED', 'Faça login para continuar.') }
  const result = resolveSession(token)
  if (result === 'expired') {
    return { response: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
  }
  if (!result) return { response: apiError(401, 'UNAUTHENTICATED', 'Sessão inválida.') }
  return { user: result.user, token }
}

/** Usuário opcional: rotas públicas que mudam de comportamento se houver sessão (ex.: carrinho). */
export function optionalUser(request: Request): AuthResult | { user: null } {
  if (!bearerToken(request)) return { user: null }
  return authenticate(request)
}

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return { response: apiError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.') }
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return {
      response: apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', {
        fieldErrors,
      }),
    }
  }
  return { data: parsed.data }
}
