import { addToCart, expect, test } from './fixtures'

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
