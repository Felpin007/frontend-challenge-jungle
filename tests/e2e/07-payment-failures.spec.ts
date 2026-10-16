import { expect, test } from './fixtures'
import { goToReview } from './helpers'

/** Cenário 7: falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido. */
test.describe('falhas de pagamento', () => {
  test('pagamento recusado preserva os itens no carrinho', async ({ page, mocks }) => {
    const review = await goToReview(page)
    await mocks.setScenario({ payment: 'decline', latency: 'none' })
    await review.getByTestId('confirm-order').click()
    await page.waitForURL('**/pedidos/**')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'declined', {
      timeout: 10_000,
    })
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
  })

  test('cliques repetidos criam um único pedido', async ({ page, mocks }) => {
    const review = await goToReview(page)
    await mocks.delayNext('POST', '/api/orders', 1200)
    const confirm = review.getByTestId('confirm-order')
    await confirm.click()
    await confirm.click({ force: true, timeout: 1000 }).catch(() => undefined)
    await confirm.click({ force: true, timeout: 1000 }).catch(() => undefined)
    await page.waitForURL('**/pedidos/**')
    expect(await mocks.orders()).toHaveLength(1)
  })

  test('timeout após criar o pedido: a nova tentativa recupera o mesmo pedido', async ({
    page,
    mocks,
  }) => {
    test.setTimeout(60_000)
    const review = await goToReview(page)
    // O servidor cria o pedido mas "perde" a resposta; o pedido fica pendente por 60 s.
    await mocks.setScenario({ orderTimeout: true, orderResolutionMs: 60_000, latency: 'none' })
    await review.getByTestId('confirm-order').click()
    // Timeout do cliente (8 s): avisa e repete com a MESMA chave de idempotência.
    await expect(
      review.getByText('Verificando o pedido com a mesma tentativa', { exact: false }),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForURL('**/pedidos/**', { timeout: 30_000 })
    const orders = await mocks.orders()
    expect(orders).toHaveLength(1) // nenhum pedido duplicado
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orders[0].id}$`))
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
    await mocks.resolvePendingOrders()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
  })
})
