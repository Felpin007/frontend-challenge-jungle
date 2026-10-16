/**
 * Cenários configuráveis do mock. Um cenário é um conjunto de flags que
 * controla latência, falhas e o resultado das simulações (pagamento, carteira).
 *
 * Seleção (em ordem de prioridade):
 *  1. parâmetro de URL `?mock-scenario=<preset>` no carregamento (é removido da URL);
 *  2. valor salvo no localStorage (`kurio:mock-scenario`);
 *  3. preset `default`.
 * Também pode ser alterado pelo painel de cenários ou por `window.__kurioMocks`.
 */

export type LatencyMode = 'none' | 'normal' | 'slow' | 'variable' | 'out-of-order'
export type FailureGroup =
  'auth' | 'nfts' | 'favorites' | 'cart' | 'quote' | 'orders' | 'profile' | 'wallets'

export interface ScenarioConfig {
  preset: PresetName | 'custom'
  latency: LatencyMode
  /** Simula queda de conexão: requisições REST falham como erro de rede. */
  offline: boolean
  /** Grupos de rotas que respondem 500. */
  serverError: FailureGroup[]
  /** Grupos de rotas que respondem 503 (falha transitória). */
  unavailable: FailureGroup[]
  emptyCatalog: boolean
  /** Duração da sessão criada no login/cadastro. */
  sessionTtlMs: number
  payment: 'confirm' | 'decline'
  /** Tempo até o pedido pendente ser confirmado/recusado. */
  orderResolutionMs: number
  /** A primeira tentativa de criar pedido cria o pedido, mas a resposta "se perde" (timeout). */
  orderTimeout: boolean
  wallet: 'approve' | 'reject'
}

export const SCENARIO_STORAGE_KEY = 'kurio:mock-scenario'

const base: ScenarioConfig = {
  preset: 'default',
  latency: 'normal',
  offline: false,
  serverError: [],
  unavailable: [],
  emptyCatalog: false,
  sessionTtlMs: 30 * 60 * 1000,
  payment: 'confirm',
  orderResolutionMs: 3000,
  orderTimeout: false,
  wallet: 'approve',
}

export const PRESETS = {
  default: { description: 'Sucesso com latência normal (150–450 ms)' },
  fast: { description: 'Sem latência (usado nos testes E2E)', latency: 'none' },
  slow: { description: 'Rede lenta: 2,5 s por requisição', latency: 'slow' },
  variable: { description: 'Latência variável (100–2000 ms)', latency: 'variable' },
  'out-of-order': {
    description: 'Respostas fora de ordem: requisições antigas chegam depois das novas',
    latency: 'out-of-order',
  },
  offline: { description: 'Sem conexão: todas as requisições REST falham', offline: true },
  'server-error': { description: 'Catálogo responde HTTP 500', serverError: ['nfts'] },
  unavailable: {
    description: 'Catálogo responde HTTP 503 (falha transitória)',
    unavailable: ['nfts'],
  },
  'empty-catalog': { description: 'Catálogo sem nenhum NFT', emptyCatalog: true },
  'short-session': { description: 'Sessão expira 60 s após o login', sessionTtlMs: 60_000 },
  'payment-declined': { description: 'Pagamentos são recusados', payment: 'decline' },
  'order-timeout': {
    description:
      'Criação do pedido sofre timeout (recuperação por idempotência); o pedido confirma em 20 s',
    orderTimeout: true,
    // Pendente por mais tempo que o timeout do cliente (8 s), para exercitar a nova tentativa.
    orderResolutionMs: 20_000,
  },
  'wallet-rejected': { description: 'A carteira recusa a conexão', wallet: 'reject' },
  'favorites-failure': { description: 'Favoritar responde HTTP 500', serverError: ['favorites'] },
} satisfies Record<string, Partial<ScenarioConfig> & { description: string }>

export type PresetName = keyof typeof PRESETS

export function isPresetName(value: string): value is PresetName {
  return value in PRESETS
}

export function buildScenario(name: PresetName): ScenarioConfig {
  const { description: _description, ...overrides } = PRESETS[name] as Partial<ScenarioConfig> & {
    description: string
  }
  return { ...base, ...overrides, preset: name }
}

let current: ScenarioConfig = base

export function getScenario(): ScenarioConfig {
  return current
}

export function setScenario(next: PresetName | Partial<ScenarioConfig>): ScenarioConfig {
  current =
    typeof next === 'string'
      ? buildScenario(next)
      : { ...current, ...next, preset: next.preset ?? 'custom' }
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(current))
  } catch {
    // localStorage indisponível: o cenário vale só para esta sessão da página.
  }
  return current
}

export function loadScenario(): ScenarioConfig {
  const url = new URL(window.location.href)
  const fromUrl = url.searchParams.get('mock-scenario')
  if (fromUrl && isPresetName(fromUrl)) {
    url.searchParams.delete('mock-scenario')
    window.history.replaceState(window.history.state, '', url)
    return setScenario(fromUrl)
  }
  try {
    const saved = localStorage.getItem(SCENARIO_STORAGE_KEY)
    if (saved) current = { ...base, ...(JSON.parse(saved) as Partial<ScenarioConfig>) }
  } catch {
    current = base
  }
  return current
}
