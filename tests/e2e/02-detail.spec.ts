import { expect, test } from './fixtures'

/** Cenário 2: acesso direto ao detalhe e tratamento de recurso inexistente. */
test.describe('detalhe do NFT', () => {
  test('acesso direto e refresh na URL do detalhe', async ({ page }) => {
    await page.goto('/nft/nft-005')
    await expect(page.getByRole('heading', { name: 'Violet Nomad #314', level: 1 })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Violet Nomad #314', level: 1 })).toBeVisible()
  })

  test('NFT inexistente e rota inexistente', async ({ page }) => {
    await page.goto('/nft/nao-existe')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('edição indisponível e limite de quantidade', async ({ page, mocks }) => {
    await page.goto('/nft/nft-001')
    // 1/1 do Emerald Ape está esgotada no seed
    // Nome acessível: "1/1 (esgotada)" e "1/50, 1.19 ETH"
    await expect(page.getByRole('radio', { name: '1/1 (esgotada)' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.getByRole('radio', { name: /^1\/50\s*,/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    // Servidor reduz o estoque da edição 1/50 para 2 (evento nft.updated)
    const edition = await mocks.edition('nft-001', 2)
    await mocks.setAvailability('nft-001', edition.id, 2)
    await expect(page.getByTestId('availability')).toContainText('Disponível: 2 de 50')

    // Só o seletor visível (desktop ou barra fixa do mobile) está na árvore de acessibilidade
    const plus = page.getByRole('button', { name: /Aumentar quantidade/ })
    const minus = page.getByRole('button', { name: /Diminuir quantidade/ })
    await expect(minus).toBeDisabled() // mínimo 1
    await plus.click()
    await expect(plus).toBeDisabled() // máximo 2
    await expect(minus).toBeEnabled()
  })
})
