import { addToCart, expect, loginViaApi, loginViaUi, logout, test } from './fixtures'
import { goToReview } from './helpers'

/** Cenário 10: eventos duplicados ou antigos, desconexão e retomada de pedido pendente. */
test.describe('resiliência do tempo real', () => {
  test('eventos duplicados e antigos são ignorados', async ({ page, mocks }) => {
    await addToCart(page, 'nft-001')
    await mocks.changePrice('nft-001', '2.5')
    const notice = page.getByText('Preço de Emerald Ape #042 mudou: 1.19 ETH → 2.50 ETH.')
    await expect(notice).toHaveCount(1)
    await expect(page.getByTestId('cart-item-price')).toHaveText('2.50 ETH')

    // Mesmo evento reenviado: não é reaplicado (nenhum aviso novo)
    expect(await mocks.replayLastEvent()).toBe(true)
    // Evento com versão antiga e preço 99.99: não pode regredir o estado
    await mocks.sendStaleNftEvent('nft-001')
    await page.waitForTimeout(800)
    await expect(notice).toHaveCount(1)
    await expect(page.getByText(/99\.99/)).toHaveCount(0)
    await expect(page.getByTestId('cart-item-price')).toHaveText('2.50 ETH')
  })

  test('desconexão com pedido pendente: ao reconectar, o estado é reconciliado pela API', async ({
    page,
    mocks,
  }) => {
    const review = await goToReview(page)
    await mocks.setScenario({ orderResolutionMs: 60_000, latency: 'none' })
    await review.getByTestId('confirm-order').click()
    await page.waitForURL('**/pedidos/**')
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')

    // Derruba o socket por 3 s e confirma o pedido nesse intervalo (o evento se perde)
    await mocks.dropRealtime(3000)
    await mocks.resolvePendingOrders()
    await expect(page.getByTestId('realtime-banner')).toBeVisible()
    // Reconexão → reconciliação com o REST → confirmado
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('realtime-banner')).toHaveCount(0)
    expect(await mocks.orders()).toHaveLength(1)
  })

  test('refresh com pedido pendente recupera o mesmo pedido, sem nova compra', async ({
    page,
    mocks,
  }) => {
    const review = await goToReview(page)
    await mocks.setScenario({ orderResolutionMs: 60_000, latency: 'none' })
    await review.getByTestId('confirm-order').click()
    await page.waitForURL('**/pedidos/**')
    const url = page.url()
    await page.reload()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
    expect(page.url()).toBe(url)

    await mocks.resolvePendingOrders()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    // Estado terminal: não volta a pendente
    await page.reload()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    expect(await mocks.orders()).toHaveLength(1)
  })

  test('logout e troca de usuário encerram a conexão da sessão anterior', async ({
    page,
    mocks,
  }) => {
    await loginViaApi(page, 'ana')
    await page.goto('/perfil')
    await expect.poll(() => mocks.connectedUsers()).toEqual(['user-ana'])

    await logout(page)
    // A conexão da Ana foi fechada; sobra uma única conexão de visitante
    await expect.poll(() => mocks.connectedUsers()).toEqual([null])

    await page.goto('/login')
    await loginViaUi(page, 'bruno')
    await expect.poll(() => mocks.connectedUsers()).toEqual(['user-bruno'])
  })
})
