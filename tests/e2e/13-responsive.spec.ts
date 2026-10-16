import { expect, loginViaApi, test } from './fixtures'

/**
 * Sem overflow horizontal nas larguras pedidas (390, 768 e 1440) e com zoom
 * de 200% (simulado com viewport de metade da largura de 1440).
 */
const WIDTHS = [390, 720, 768, 1440]
const PAGES = [
  '/',
  '/nft/nft-001',
  '/carrinho',
  '/login',
  '/cadastro',
  '/perfil',
  '/perfil/carteiras',
  '/pagamento',
]

test('sem overflow horizontal em 390, 768, 1440 e zoom 200%', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, 'Executado uma vez, no projeto desktop')
  test.setTimeout(120_000)
  await loginViaApi(page, 'ana')
  await page.evaluate(async () => {
    const token = JSON.parse(localStorage.getItem('kurio:session')!).token
    await fetch('/api/cart/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ nftId: 'nft-001', editionId: 'nft-001-1-50', quantity: 1 }),
    })
  })
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PAGES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      if (overflow > 0) failures.push(`${path} @ ${width}px: ${overflow}px`)
    }
  }
  expect(failures).toEqual([])
})
