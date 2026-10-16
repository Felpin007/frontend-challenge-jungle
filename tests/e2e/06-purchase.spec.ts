import { expect, isMobile, loginViaApi, test } from './fixtures'

/** Cenário 6: compra completa, do catálogo ao recibo confirmado. */
test('compra completa: catálogo → detalhe → carrinho → pagamento → recibo confirmado', async ({
  page,
  mocks,
}) => {
  await loginViaApi(page, 'ana')
  await page.goto('/')

  // Catálogo → detalhe
  await page.getByRole('link', { name: 'Emerald Ape #042' }).first().click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()

  // Detalhe → carrinho
  if (isMobile(page)) await page.getByRole('button', { name: 'Comprar NFT', exact: true }).click()
  else await page.getByTestId('buy-button').click()
  await page.waitForURL('**/carrinho')
  await expect(page.getByTestId('cart-item')).toHaveCount(1)
  await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH') // 1.19 + 0.016 de taxa

  // Carrinho → pagamento
  await page.getByTestId('checkout-button').click()
  await page.waitForURL('**/pagamento')
  await page.getByTestId('connect-wallet').click()
  await expect(page.getByText('Carteira conectada')).toBeVisible()
  await page.getByTestId('confirm-purchase').click()

  // Revisão → envio
  const review = page.getByTestId('review-dialog')
  await expect(review).toBeVisible()
  await expect(review.getByTestId('quote-total')).toHaveText('1.206 ETH')
  await review.getByTestId('confirm-order').click()

  // Pedido pendente → confirmado (evento order.updated pelo Socket.IO)
  await page.waitForURL('**/pedidos/**')
  const status = page.getByTestId('order-status')
  await expect(status).toHaveAttribute('data-status', 'pending')
  await expect(status).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
  await expect(page.getByTestId('order-total')).toHaveText('1.206 ETH')
  await expect(page.getByTestId('order-reference')).toHaveText(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/)

  // Recibo é snapshot: mudar o preço no catálogo depois não altera o pedido.
  await mocks.changePrice('nft-001', '5')
  await page.reload()
  await expect(page.getByTestId('order-total')).toHaveText('1.206 ETH')

  // Itens comprados saem do carrinho
  await page.goto('/carrinho')
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  expect(await mocks.orders()).toHaveLength(1)
})
