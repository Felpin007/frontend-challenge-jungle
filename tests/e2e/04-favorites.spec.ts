import { expect, isMobile, loginViaApi, test } from './fixtures'

const favoriteToggle = (page: import('@playwright/test').Page) =>
  isMobile(page) ? page.getByTestId('favorite-toggle-mobile') : page.getByTestId('favorite-toggle')

/** Cenário 4: favoritos, falha de mutation (rollback) e recuperação. */
test.describe('favoritos', () => {
  test('favoritar persiste para o usuário autenticado', async ({ page }) => {
    await loginViaApi(page, 'carla')
    await page.goto('/nft/nft-003')
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'false')
    await favoriteToggle(page).click()
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/perfil/favoritos')
    await expect(page.getByTestId('nft-card')).toHaveCount(1)
  })

  test('falha ao favoritar desfaz a atualização otimista e permite tentar de novo', async ({
    page,
    mocks,
  }) => {
    await loginViaApi(page, 'carla')
    await page.goto('/nft/nft-003')
    // Janela de 1,5 s para observar o estado otimista antes da falha
    await mocks.delayNext('PUT', '/api/favorites/*', 1500)
    await mocks.failNext('PUT', '/api/favorites/*', 500)
    await favoriteToggle(page).click()
    // Otimista: marca na hora…
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'true')
    // …e volta ao estado anterior quando a API falha
    await expect(
      page.getByText('Não foi possível favoritar Neon Vessel #552. Tente novamente.'),
    ).toBeVisible()
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'false')

    // Fecha o aviso (no mobile ele fica sobre o cabeçalho) e tenta de novo
    await page.getByRole('button', { name: 'Close toast' }).first().click()
    await favoriteToggle(page).click()
    await expect(page.getByText('Neon Vessel #552 adicionado aos favoritos.')).toBeVisible()
    await page.reload()
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('visitante é levado ao login ao favoritar', async ({ page }) => {
    await page.goto('/nft/nft-003')
    await favoriteToggle(page).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnft%2Fnft-003/)
  })
})
