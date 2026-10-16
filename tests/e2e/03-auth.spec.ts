import { addToCart, expect, loginViaApi, loginViaUi, logout, test } from './fixtures'

/** Cenário 3: cadastro, login, expiração de sessão, logout e troca de usuário. */
test.describe('conta e sessão', () => {
  test('cadastro com validação, conflito e sucesso', async ({ page }) => {
    await page.goto('/cadastro')
    await page
      .getByRole('button', { name: /Criar (conta|perfil)/ })
      .last()
      .click()
    await expect(
      page.getByText('Use 3 a 24 caracteres: letras minúsculas, números, ponto ou _'),
    ).toBeVisible()
    await expect(page.getByText('Informe um e-mail válido')).toBeVisible()

    await page.getByPlaceholder('Nome de usuário').fill('nova.colecionadora')
    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByPlaceholder('Senha', { exact: true }).fill('Senha123')
    await page.getByPlaceholder('Confirmar senha').fill('Senha123')
    await page
      .getByRole('button', { name: /Criar (conta|perfil)/ })
      .last()
      .click()
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()

    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('nova@kurio.dev')
    await page
      .getByRole('button', { name: /Criar (conta|perfil)/ })
      .last()
      .click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('nova.colecionadora')
  })

  test('login inválido, login com retorno ao fluxo anterior e sessão após refresh', async ({
    page,
  }) => {
    await page.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil%2Fcarteiras/)
    await page.getByPlaceholder('contato@email.com').fill('ana@kurio.dev')
    await page.getByPlaceholder('Senha', { exact: true }).fill('senha-errada1')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()

    await loginViaUi(page, 'ana')
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('sessão expira durante a navegação (relógio controlado) e preserva o retorno', async ({
    page,
  }) => {
    await page.clock.install()
    await loginViaApi(page, 'ana')
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Lima')
    // A sessão dura 30 min: avançamos o relógio da página
    await page.clock.fastForward('31:00')
    await page.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/login\?.*redirect=%2Fperfil%2Fcarteiras.*reason=expired/)
    await expect(
      page.getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.'),
    ).toBeVisible()
    await loginViaUi(page, 'ana')
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
  })

  test('sessão expira durante o checkout: login e retomada com o formulário preservado', async ({
    page,
    mocks,
  }) => {
    await loginViaApi(page, 'ana')
    await addToCart(page, 'nft-001')
    await page.getByTestId('checkout-button').click()
    await page.waitForURL('**/pagamento')
    const note = page.getByLabel('Observação do colecionador (opcional)')
    await note.fill('Entregar na carteira principal, por favor')

    await mocks.expireSessions()
    await page.getByTestId('connect-wallet').click() // primeira chamada à API após expirar
    await expect(page).toHaveURL(/\/login\?.*redirect=%2Fpagamento.*reason=expired/)
    await loginViaUi(page, 'ana')
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue(
      'Entregar na carteira principal, por favor',
    )
    await expect(page.getByTestId('cart-item').or(page.getByTestId('quote-total'))).not.toHaveCount(
      0,
    )
  })

  test('logout limpa dados privados e a troca de usuário não vaza dados', async ({ page }) => {
    await loginViaApi(page, 'ana')
    await page.goto('/perfil/favoritos')
    await expect(page.getByTestId('nft-card')).toHaveCount(2) // favoritos da Ana
    await logout(page)
    await page.goto('/perfil/favoritos')
    await expect(page).toHaveURL(/\/login/)

    await loginViaUi(page, 'bruno')
    await expect(page).toHaveURL(/\/perfil\/favoritos$/)
    await expect(page.getByTestId('nft-card')).toHaveCount(1) // só o favorito do Bruno
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-item')).toHaveCount(1) // carrinho do Bruno, não o da Ana
  })
})
