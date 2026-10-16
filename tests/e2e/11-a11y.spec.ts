import { expect, isMobile, test } from './fixtures'

/** Cenário 11: navegação por teclado, foco em diálogos e validação de formulários. */
test.describe('acessibilidade', () => {
  test('link "Pular para o conteúdo" é o primeiro foco e leva ao conteúdo', async ({ page }) => {
    await page.goto('/')
    // O app só renderiza depois que os mocks sobem (após o evento load)
    await expect(page.getByTestId('nft-card').first()).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo$/)
  })

  test('diálogo de busca: abre pelo teclado, prende o foco e devolve ao fechar', async ({
    page,
  }) => {
    test.skip(isMobile(page), 'No mobile a busca fica no topo da página')
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar no mercado' })
    await expect(dialog).toBeVisible()
    await expect(page.getByLabel('Termo de busca')).toBeFocused()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('busca pelo teclado leva ao resultado', async ({ page }) => {
    test.skip(isMobile(page), 'No mobile a busca fica no topo da página')
    await page.goto('/')
    await page.getByRole('button', { name: 'Buscar NFTs' }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.type('Emerald')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=Emerald/)
    await expect(page.getByTestId('nft-card')).toHaveCount(1)
  })

  test('drawer de filtros (mobile) prende e devolve o foco', async ({ page }) => {
    test.skip(!isMobile(page), 'Filtros ficam na barra lateral no desktop')
    await page.goto('/')
    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Tab')
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('modal de login prende o foco (desktop)', async ({ page }) => {
    test.skip(isMobile(page), 'No mobile o login é uma página cheia')
    await page.goto('/login')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
  })

  test('erros de validação ficam associados aos campos', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.getByPlaceholder('contato@email.com')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('Informe um e-mail válido')
    // Foco vai para o primeiro campo inválido
    await expect(email).toBeFocused()
  })

  test('formulário de login funciona só com teclado', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('contato@email.com').focus()
    await page.keyboard.type('ana@kurio.dev')
    await page.keyboard.press('Tab')
    await page.keyboard.type('Kurio@2026')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/$/)
  })
})
