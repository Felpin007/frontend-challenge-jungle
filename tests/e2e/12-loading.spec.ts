import { addToCart, expect, isMobile, test } from './fixtures'

/** Cenário 12: skeletons em carregamento lento, feedback de falha e recuperação após nova tentativa. */
test.describe('carregamento lento', () => {
  test.use({ scenario: 'slow' })

  test('skeletons no catálogo e no detalhe enquanto a rede está lenta', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card-skeleton')).toHaveCount(9)
    await expect(page.getByTestId('nft-card')).toHaveCount(9, { timeout: 15_000 })
    await expect(page.getByTestId('nft-card-skeleton')).toHaveCount(0)

    await page.goto('/nft/nft-001')
    await expect(page.getByTestId('detail-skeleton')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe('falha e recuperação', () => {
  test.use({ scenario: 'server-error' })

  test('erro no catálogo mostra feedback e recupera ao tentar de novo', async ({ page, mocks }) => {
    await page.goto('/')
    await expect(page.getByText('Não foi possível carregar o catálogo')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Erro interno do servidor.')).toBeVisible()
    await mocks.setScenario('fast')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
  })
})

test.describe('resumo do carrinho', () => {
  test('skeleton do resumo enquanto a cotação carrega', async ({ page, mocks }) => {
    await addToCart(page, 'nft-001')
    // O cenário fica salvo no localStorage, então vale também após o reload
    await mocks.setScenario('slow')
    await page.reload()
    await expect(page.getByTestId('quote-skeleton')).toBeVisible()
    await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH', { timeout: 15_000 })
  })

  test('sem conexão: erro com nova tentativa', async ({ page, mocks }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    await mocks.setScenario({ offline: true, latency: 'none' })
    await page.goto('/nft/nft-009')
    await expect(page.getByText('Sem conexão com o servidor. Verifique sua internet.')).toBeVisible(
      { timeout: 15_000 },
    )
    await mocks.setScenario('fast')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { name: 'Golden Signal #160', level: 1 })).toBeVisible()
  })

  test('animações respeitam movimento reduzido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const duration = await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'shimmer'
      document.body.append(el)
      return getComputedStyle(el, '::after').animationDuration
    })
    expect(parseFloat(duration)).toBeLessThan(0.01)
  })
})

test.describe('falhas da camada simulada', () => {
  test('cotação com erro: só o erro aparece (sem skeleton) e a nova tentativa recupera', async ({
    page,
    mocks,
  }) => {
    await page.goto('/nft/nft-001')
    await mocks.ready()
    // A falha é injetada depois de carregar a página (um reload reinicia o servidor simulado).
    // 500 é transitório: a primeira tentativa e as 2 repetições automáticas falham.
    await page.evaluate(() =>
      window.__kurioMocks!.failNext({ method: 'POST', path: '/api/quotes', status: 500, times: 3 }),
    )
    if (isMobile(page)) await page.getByRole('button', { name: 'Comprar NFT', exact: true }).click()
    else await page.getByTestId('buy-button').click()
    await page.waitForURL('**/carrinho')
    await expect(page.getByText('Não foi possível calcular os valores')).toBeVisible()
    await expect(page.getByTestId('quote-skeleton')).toHaveCount(0)
    await expect(page.getByTestId('checkout-button')).toBeDisabled()
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH')
    await expect(page.getByTestId('checkout-button')).toBeEnabled()
  })

  test('service worker encerrado pelo navegador: a API simulada continua respondendo', async ({
    page,
  }) => {
    // Navegadores encerram service workers ociosos (ex.: aba em segundo plano). Ao reiniciar,
    // o worker do MSW esquecia as abas ativas e /api/* ia para a rede (404 no deploy).
    await page.goto('/')
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('ServiceWorker.enable')
    await cdp.send('ServiceWorker.stopAllWorkers')

    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/tab=trending/)
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    await expect(page.getByText(/Não foi possível|Erro inesperado/)).toHaveCount(0)
    const status = await page.evaluate(async () => (await fetch('/api/nfts/featured')).status)
    expect(status).toBe(200)
  })
})
