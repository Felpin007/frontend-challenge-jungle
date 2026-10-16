import { addToCart, expect, test } from './fixtures'
import { goToReview } from './helpers'

/**
 * Cenário 9: alteração de preço/disponibilidade via Socket.IO durante o checkout.
 * As mudanças são feitas no servidor simulado; o app as recebe como `nft.updated`
 * pelo socket.io-client.
 */
test.describe('tempo real no carrinho e checkout', () => {
  test('preço muda com o NFT no carrinho: aviso e resumo atualizado', async ({ page, mocks }) => {
    await addToCart(page, 'nft-001')
    await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH')

    await mocks.changePrice('nft-001', '1.5')
    await expect(
      page.getByText('Preço de Emerald Ape #042 mudou: 1.19 ETH → 1.50 ETH.'),
    ).toBeVisible()
    await expect(page.getByTestId('cart-item-status')).toHaveText('Preço atualizado: era 1.19 ETH.')
    await expect(page.getByTestId('quote-total')).toHaveText('1.516 ETH')
    await page.getByRole('button', { name: 'Entendi' }).click()
    await expect(page.getByTestId('price-change-notice')).toHaveCount(0)
  })

  test('checkout impede confirmar com cotação desatualizada e exige nova confirmação', async ({
    page,
    mocks,
  }) => {
    const review = await goToReview(page)
    await expect(review.getByTestId('quote-total')).toHaveText('1.206 ETH')

    await mocks.changePrice('nft-001', '2')
    await review.getByTestId('confirm-order').click()
    await expect(review.getByTestId('quote-changed')).toBeVisible()
    await expect(review.getByTestId('quote-total')).toHaveText('2.016 ETH')
    expect(await mocks.orders()).toHaveLength(0) // nada foi comprado com o preço antigo

    await review.getByRole('button', { name: 'Confirmar novos valores' }).click()
    await page.waitForURL('**/pedidos/**')
    await expect(page.getByTestId('order-total')).toHaveText('2.016 ETH')
  })

  test('edição esgota durante o checkout: confirmação bloqueada', async ({ page, mocks }) => {
    const review = await goToReview(page)
    const edition = await mocks.edition('nft-001', 2)
    await mocks.setAvailability('nft-001', edition.id, 0)
    await review.getByTestId('confirm-order').click()
    await expect(review.getByText('Emerald Ape #042 (1/50) esgotou.').first()).toBeVisible()
    await expect(review.getByTestId('confirm-order')).toBeDisabled()
    await expect(review.getByRole('link', { name: 'Ajustar carrinho' })).toBeVisible()
    expect(await mocks.orders()).toHaveLength(0)
  })

  test('preço muda enquanto o visitante está no catálogo e no detalhe', async ({ page, mocks }) => {
    await page.goto('/nft/nft-005')
    await expect(page.getByRole('heading', { name: 'Violet Nomad #314', level: 1 })).toBeVisible()
    await mocks.changePrice('nft-005', '3.33')
    await expect(page.getByText('3.33 ETH').filter({ visible: true }).first()).toBeVisible()
  })
})
