import type { Page } from '@playwright/test'
import { expect, isMobile, test } from './fixtures'

async function openFilters(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: /^Filtros/ }).click()
}
async function closeFilters(page: Page) {
  if (isMobile(page)) await page.keyboard.press('Escape')
}
const summary = (page: Page) => page.getByText(/NFTs? encontrados?, página/)

/** Cenário 1: busca, filtros combinados, ordenação, paginação e restauração pelo histórico. */
test.describe('catálogo', () => {
  test('filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh e histórico', async ({
    page,
    mocks,
  }) => {
    await page.goto('/')
    await expect(summary(page)).toHaveText('48 NFTs encontrados, página 1 de 6')

    // Paginação
    await page.getByRole('button', { name: 'Página 2', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(summary(page)).toHaveText('48 NFTs encontrados, página 2 de 6')

    // Filtro reinicia a paginação; filtros são combináveis
    await openFilters(page)
    await page.getByRole('checkbox', { name: /Música/ }).check()
    await expect(page).toHaveURL(/categories=musica/)
    await expect(page).not.toHaveURL(/page=/)
    await page.getByRole('checkbox', { name: /Polygon/ }).check()
    await expect(page).toHaveURL(/networks=polygon/)
    await closeFilters(page)

    const expected =
      (await mocks.ready(),
      await page.evaluate(
        () =>
          window
            .__kurioMocks!.snapshot()
            .nfts.filter((n) => n.category === 'musica' && n.network === 'polygon').length,
      ))
    await expect(summary(page)).toContainText(`${expected} NFT`)

    // Ordenação (no mobile ela fica na gaveta de filtros, como no Figma)
    await openFilters(page)
    await page.getByTestId('sort-select').click()
    await page.getByRole('option', { name: 'Maior preço' }).click()
    await expect(page).toHaveURL(/sort=price-desc/)
    await closeFilters(page)

    // Refresh mantém o estado
    await page.reload()
    await openFilters(page)
    await expect(page.getByRole('checkbox', { name: /Música/ })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /Polygon/ })).toBeChecked()
    await expect(page.getByTestId('sort-select')).toHaveText('Maior preço')
    await closeFilters(page)

    // Histórico: voltar desfaz a ordenação, avançar refaz
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=/)
    await openFilters(page)
    await expect(page.getByTestId('sort-select')).toHaveText('Listados recentemente')
    await closeFilters(page)
    await page.goForward()
    await expect(page).toHaveURL(/sort=price-desc/)
  })

  test('busca por nome e resultado vazio', async ({ page }) => {
    // A busca considera nome e coleção
    await page.goto('/?q=Emerald')
    await expect(page.getByTestId('nft-card')).toHaveCount(1)
    await expect(page.getByTestId('nft-card')).toContainText('Emerald Ape #042')
    await page.goto('/?q=golden%20frequencies')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()

    await page.goto('/?q=inexistente-xyz')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
  })

  test('respostas fora de ordem: a resposta antiga não sobrescreve a seleção atual', async ({
    page,
    mocks,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    // A primeira requisição (aba "Novos") demora 1,5 s; a segunda (aba "Em alta") é imediata.
    await mocks.delayNext('GET', '/api/nfts', 1500)
    await page.getByRole('tab', { name: 'Novos lançamentos' }).click()
    await page.getByRole('tab', { name: 'Em alta' }).click()
    const trending = await page.evaluate(
      () => window.__kurioMocks!.snapshot().nfts.filter((n) => n.popularity >= 500).length,
    )
    await expect(summary(page)).toContainText(`${trending} NFT`)
    // Depois que a resposta lenta chega, a tela continua mostrando "Em alta".
    await page.waitForTimeout(1800)
    await expect(page.getByRole('tab', { name: 'Em alta' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(summary(page)).toContainText(`${trending} NFT`)
  })
})
