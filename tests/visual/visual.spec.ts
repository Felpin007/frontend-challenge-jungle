import { existsSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { addToCart, expect, loginViaApi, test } from '../e2e/fixtures'

/**
 * As baselines são por sistema operacional (fontes renderizam diferente em cada um).
 * Sem baseline para a plataforma atual, o teste é pulado com a instrução para gerá-la,
 * em vez de falhar por diferença de antialiasing.
 */
function requireBaseline(name: string) {
  const info = test.info()
  const updating = ['all', 'changed'].includes(info.config.updateSnapshots)
  test.skip(
    !updating && !existsSync(info.snapshotPath(name)),
    `Sem baseline de ${name} para ${process.platform}: gere com "npm run test:visual:update".`,
  )
}

/**
 * Regressão visual de Início, Detalhe, Carrinho e Pagamento (desktop 1440).
 * Dados estáveis: seed determinístico, cenário sem latência, animações
 * desligadas. Baselines versionadas em tests/visual/__screenshots__.
 * Para atualizar: npm run test:visual:update
 */
async function settle(page: Page, { footer = true } = {}) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // Seções abaixo da dobra são renderizadas sob demanda
  if (footer) await expect(page.locator('footer')).toBeAttached()
  // Rola a página inteira para carregar as imagens com loading="lazy"
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    window.scrollTo(0, 0)
  })
  // Imagens fora da tela na horizontal (carrossel) não carregam com loading="lazy"
  await page.evaluate(() => {
    for (const img of Array.from(document.images)) img.loading = 'eager'
  })
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete))
  // - painel de cenários e avisos (toasts): fora da comparação;
  // - content-visibility: o Chromium não pinta seções fora da tela, e a captura
  //   de página inteira sairia com blog e rodapé em branco.
  await page.addStyleTag({
    content:
      '[data-testid="mock-panel-trigger"],[data-sonner-toaster]{visibility:hidden} *{content-visibility:visible!important}',
  })
}

test('início', async ({ page }) => {
  requireBaseline('inicio.png')
  await page.goto('/')
  await expect(page.getByTestId('nft-card')).toHaveCount(9)
  await expect(page.getByRole('heading', { name: 'Diário da Cunhagem' })).toBeAttached()
  await settle(page)
  await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
})

test('detalhe do NFT', async ({ page }) => {
  requireBaseline('detalhe.png')
  await page.goto('/nft/nft-001')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
  await expect(page.getByTestId('nft-card')).toHaveCount(15) // carrossel "Mais desta coleção"
  await settle(page)
  await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
})

test('carrinho', async ({ page }) => {
  requireBaseline('carrinho.png')
  await addToCart(page, 'nft-001', 2)
  await addToCart(page, 'nft-005')
  await expect(page.getByTestId('quote-total')).toHaveText('3.786 ETH')
  await settle(page)
  await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
})

test('pagamento', async ({ page }) => {
  requireBaseline('pagamento.png')
  await loginViaApi(page, 'ana')
  await addToCart(page, 'nft-001', 2)
  await addToCart(page, 'nft-005')
  await page.getByTestId('checkout-button').click()
  await page.waitForURL('**/pagamento')
  await expect(page.getByTestId('quote-total')).toHaveText('3.786 ETH')
  await settle(page, { footer: false }) // checkout não tem rodapé
  await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
})
