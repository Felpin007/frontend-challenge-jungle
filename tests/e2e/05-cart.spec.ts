import { addToCart, expect, loginViaUi, test } from './fixtures'

/** Cenário 5: carrinho, quantidades, remoção, cupom e persistência após refresh/login. */
test.describe('carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh', async ({ page }) => {
    await addToCart(page, 'nft-001') // 1.19
    await addToCart(page, 'nft-005') // 1.39
    await expect(page.getByTestId('cart-item')).toHaveCount(2)
    await expect(page.getByTestId('quote-subtotal')).toHaveText('2.58 ETH')

    // Quantidade
    await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
    await expect(page.getByTestId('quote-subtotal')).toHaveText('3.77 ETH')

    // Remoção
    await page.getByRole('button', { name: 'Remover Violet Nomad #314 do carrinho' }).click()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(page.getByTestId('quote-subtotal')).toHaveText('2.38 ETH')

    // Cupom inválido, expirado e válido
    const coupon = page.getByTestId('coupon-input')
    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByText('Código promocional inválido.')).toBeVisible()
    await coupon.fill('VERAO25')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByText('Este código promocional expirou.')).toBeVisible()
    await coupon.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.238 ETH')
    await expect(page.getByTestId('quote-total')).toHaveText('2.158 ETH') // 2.38 - 0.238 + 0.016

    // Refresh mantém itens e cupom
    await page.reload()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(page.getByTestId('quote-total')).toHaveText('2.158 ETH')

    // Remover cupom
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByTestId('quote-total')).toHaveText('2.396 ETH')
  })

  test('itens do visitante são preservados ao autenticar', async ({ page }) => {
    await addToCart(page, 'nft-002')
    await page.getByTestId('checkout-button').click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento/)
    await loginViaUi(page, 'bruno') // Bruno já tem 1 item salvo na conta
    await expect(page).toHaveURL(/\/pagamento$/)
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-item')).toHaveCount(2)
    await expect(page.getByText('Sage Nomad #009')).toBeVisible()
  })
})
