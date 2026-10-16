import { test as base, expect, type Page } from '@playwright/test'
// Só tipos (apagados em tempo de execução): traz a declaração de window.__kurioMocks.
export type { MockControl } from '../../src/mocks/control'
import type { PresetName, ScenarioConfig } from '../../src/mocks/scenarios'

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@2026', name: 'Ana Lima' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@2026', name: 'Bruno Reis' },
  carla: { email: 'carla@kurio.dev', password: 'Kurio@2026', name: 'Carla Dias' },
} as const

type UserKey = keyof typeof USERS

/**
 * Acesso ao servidor simulado (window.__kurioMocks). É o equivalente a
 * "mexer no backend" durante o teste: o app só percebe os efeitos pelas
 * respostas REST (MSW) e pelos eventos do socket.io-client.
 */
export class Mocks {
  constructor(private readonly page: Page) {}

  async ready() {
    await this.page.waitForFunction(() => Boolean(window.__kurioMocks))
  }

  async setScenario(scenario: PresetName | Partial<ScenarioConfig>) {
    await this.ready()
    await this.page.evaluate((s) => void window.__kurioMocks!.setScenario(s), scenario)
  }
  async changePrice(nftId: string, price: string) {
    await this.ready()
    await this.page.evaluate(
      ([id, p]) => void window.__kurioMocks!.changePrice(id, p),
      [nftId, price],
    )
  }
  async setAvailability(nftId: string, editionId: string, available: number) {
    await this.ready()
    await this.page.evaluate(
      ([id, ed, qty]) => void window.__kurioMocks!.setAvailability(id, ed, qty),
      [nftId, editionId, available] as const,
    )
  }
  async failNext(method: string, path: string, status = 500, network = false) {
    await this.ready()
    await this.page.evaluate(
      ([m, p, s, n]) =>
        window.__kurioMocks!.failNext({ method: m, path: p, status: s, network: n }),
      [method, path, status, network] as const,
    )
  }
  async delayNext(method: string, path: string, ms: number) {
    await this.ready()
    await this.page.evaluate(
      ([m, p, d]) => window.__kurioMocks!.delayNext({ method: m, path: p, ms: d }),
      [method, path, ms] as const,
    )
  }
  async expireSessions() {
    await this.ready()
    await this.page.evaluate(() => window.__kurioMocks!.expireSessions())
  }
  async dropRealtime(outageMs: number) {
    await this.ready()
    await this.page.evaluate((ms) => window.__kurioMocks!.dropRealtime(ms), outageMs)
  }
  async replayLastEvent() {
    await this.ready()
    return this.page.evaluate(() => window.__kurioMocks!.replayLastEvent())
  }
  async sendStaleNftEvent(nftId: string) {
    await this.ready()
    return this.page.evaluate((id) => window.__kurioMocks!.sendStaleNftEvent(id), nftId)
  }
  async resolvePendingOrders() {
    await this.ready()
    await this.page.evaluate(() => window.__kurioMocks!.resolvePendingOrders())
  }
  async connectionCount() {
    await this.ready()
    return this.page.evaluate(() => window.__kurioMocks!.connectionCount())
  }
  async orders() {
    await this.ready()
    return this.page.evaluate(() =>
      window
        .__kurioMocks!.snapshot()
        .orders.map((o) => ({ id: o.id, status: o.status, userId: o.userId, total: o.total })),
    )
  }
  async edition(nftId: string, index = 0) {
    await this.ready()
    return this.page.evaluate(
      ([id, i]) => window.__kurioMocks!.snapshot().nfts.find((n) => n.id === id)!.editions[i],
      [nftId, index] as const,
    )
  }
}

export const test = base.extend<{ mocks: Mocks; scenario: PresetName }>({
  scenario: ['fast', { option: true }],
  // Antes de qualquer script da página: escolhe o cenário (sem sobrescrever
  // mudanças feitas pelo próprio teste em navegações seguintes).
  page: async ({ page, scenario }, use) => {
    await page.addInitScript((preset) => {
      if (!localStorage.getItem('kurio:mock-scenario')) {
        const presets: Record<string, object> = {
          fast: { preset: 'fast', latency: 'none' },
          slow: { preset: 'slow', latency: 'slow' },
          'out-of-order': { preset: 'out-of-order', latency: 'out-of-order' },
          'server-error': { preset: 'server-error', latency: 'none', serverError: ['nfts'] },
        }
        localStorage.setItem(
          'kurio:mock-scenario',
          JSON.stringify(presets[preset] ?? { preset, latency: 'none' }),
        )
      }
    }, scenario)
    await use(page)
  },
  mocks: async ({ page }, use) => {
    await use(new Mocks(page))
  },
})

export { expect }

export function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 1024
}

/** Login pela interface (formulário real). */
export async function loginViaUi(page: Page, user: UserKey = 'ana') {
  const { email, password } = USERS[user]
  await page.getByPlaceholder('contato@email.com').fill(email)
  await page.getByPlaceholder('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Login direto pela API (mais rápido, para testes que não são sobre login). */
export async function loginViaApi(page: Page, user: UserKey = 'ana') {
  const { email, password } = USERS[user]
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__kurioMocks))
  await page.evaluate(
    async ([e, p]) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: e, password: p }),
      })
      const session = await response.json()
      localStorage.setItem(
        'kurio:session',
        JSON.stringify({
          token: session.token,
          userId: session.user.id,
          expiresAt: session.expiresAt,
        }),
      )
    },
    [email, password] as const,
  )
}

export async function openAccountMenu(page: Page) {
  if (isMobile(page)) {
    await page.getByRole('link', { name: 'Meu perfil' }).click()
  } else {
    await page.getByTestId('account-menu').click()
  }
}

export async function logout(page: Page) {
  if (isMobile(page)) {
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Meu perfil' })
      .click()
    await page.getByTestId('profile-logout').click()
  } else {
    await page.getByTestId('account-menu').click()
    await page.getByTestId('logout').click()
  }
}

export async function addToCart(page: Page, nftId: string, quantity = 1) {
  await page.goto(`/nft/${nftId}`)
  const desktop = !isMobile(page)
  for (let i = 1; i < quantity; i++) {
    await page.getByRole('button', { name: /Aumentar quantidade/ }).click()
  }
  if (desktop) {
    await page.getByTestId('buy-button').click()
  } else {
    await page.getByRole('button', { name: 'Comprar NFT', exact: true }).click()
  }
  await page.waitForURL('**/carrinho')
  await expect(page.getByTestId('cart-item').first()).toBeVisible()
}
