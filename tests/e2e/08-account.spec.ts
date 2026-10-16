import { expect, loginViaApi, loginViaUi, logout, test } from './fixtures'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** Cenário 8: edição de perfil, avatar, senha e carteiras, com erros de validação. */
test.describe('perfil e carteiras', () => {
  test('editar perfil com validação, conflito e persistência', async ({ page }) => {
    await loginViaApi(page, 'ana')
    await page.goto('/perfil')
    const username = page.getByLabel('Nome de usuário')
    const save = page.getByRole('button', { name: 'Salvar', exact: true })

    await username.fill('nome inválido')
    await save.click()
    await expect(
      page.getByText('Use 3 a 24 caracteres: letras minúsculas, números, ponto ou _'),
    ).toBeVisible()
    await expect(username).toHaveAttribute('aria-invalid', 'true')

    await username.fill('bruno.reis') // pertence a outro usuário
    await save.click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()

    await username.fill('ana.coleciona')
    await page.getByLabel('Nome de exibição').fill('Ana Colecionadora')
    await save.click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Colecionadora')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('ana.coleciona')
  })

  test('avatar: envio, tipo inválido e remoção', async ({ page }) => {
    await loginViaApi(page, 'ana')
    await page.goto('/perfil')
    const input = page.getByTestId('avatar-input')
    await input.setInputFiles({
      name: 'nota.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('não sou imagem'),
    })
    await expect(page.getByText('Use uma imagem PNG, JPEG ou WEBP.')).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1X1 })
    await expect(page.getByTestId('avatar-image')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-image')).toBeVisible()

    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByTestId('avatar-image')).toHaveCount(0)
  })

  test('alterar senha: senha atual errada, confirmação divergente e sucesso', async ({ page }) => {
    await loginViaApi(page, 'carla')
    await page.goto('/perfil')
    const current = page.getByLabel('Senha atual')
    const next = page.getByLabel('Nova senha', { exact: true })
    const confirm = page.getByLabel('Confirmar nova senha')
    const submit = page.getByRole('button', { name: 'Salvar nova senha' })

    await current.fill('errada123')
    await next.fill('NovaSenha1')
    await confirm.fill('Diferente1')
    await submit.click()
    await expect(page.getByText('As senhas não conferem')).toBeVisible()

    await confirm.fill('NovaSenha1')
    await submit.click()
    await expect(page.getByText('Senha atual incorreta.')).toBeVisible()

    await current.fill('Kurio@2026')
    await submit.click()
    await expect(page.getByText('Senha alterada.')).toBeVisible()

    // A nova senha vale no próximo login
    await logout(page)
    await page.goto('/login')
    await page.getByPlaceholder('contato@email.com').fill('carla@kurio.dev')
    await page.getByPlaceholder('Senha', { exact: true }).fill('NovaSenha1')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('carteiras: cadastro com validação, persistência e carteira secundária', async ({
    page,
  }) => {
    await loginViaApi(page, 'carla') // Carla começa sem carteiras
    await page.goto('/perfil/carteiras')
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    const form = page.getByTestId('wallet-form-primary')
    await form.getByLabel('Nome de exibição').fill('Carla Dias')
    await form.getByLabel('Apelido da carteira').fill('Principal')
    await form.getByLabel('Nome do perfil').fill('Carla Coleciona')
    await form.getByLabel('Endereço da carteira').fill('0x123')
    await form.getByLabel('Código de indicação').fill('CARLA1')
    await form.getByLabel('E-mail').fill('carla@kurio.dev')
    await form.getByLabel('Nome ENS').fill('carladias')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(
      form.getByText('Endereço deve ter 0x seguido de 40 caracteres hexadecimais'),
    ).toBeVisible()

    await form.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.')).toBeVisible()
    await page.reload()
    await expect(
      page.getByTestId('wallet-form-primary').getByLabel('Endereço da carteira'),
    ).toHaveValue('0x1111111111111111111111111111111111111111')

    // Secundária copiando os dados da principal
    await page.getByLabel('Igual à carteira principal').check()
    const secondary = page.getByTestId('wallet-form-secondary')
    await expect(secondary.getByLabel('Endereço da carteira')).toHaveValue(
      '0x1111111111111111111111111111111111111111',
    )
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.')).toBeVisible()
  })

  test('troca de usuário após editar perfil não mostra dados do anterior', async ({ page }) => {
    await loginViaApi(page, 'ana')
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Lima')
    await logout(page)
    await page.goto('/perfil')
    await loginViaUi(page, 'bruno')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Bruno Reis')
  })
})
