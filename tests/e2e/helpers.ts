import type { Page } from '@playwright/test'
import { addToCart, expect, loginViaApi } from './fixtures'

/** Leva a Ana até a revisão do pedido com um item no carrinho. */
export async function goToReview(page: Page, nftId = 'nft-001') {
  await loginViaApi(page, 'ana')
  await addToCart(page, nftId)
  await page.getByTestId('checkout-button').click()
  await page.waitForURL('**/pagamento')
  await page.getByTestId('connect-wallet').click()
  await expect(page.getByTestId('wallet-connection').getByText('Carteira conectada')).toBeVisible()
  await page.getByTestId('confirm-purchase').click()
  const review = page.getByTestId('review-dialog')
  await expect(review).toBeVisible()
  return review
}
