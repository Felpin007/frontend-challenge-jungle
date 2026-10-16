import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { LoginForm } from '@/features/auth/AuthForms'
import { authSearchSchema } from '@/features/auth/search'
import { sessionStore } from '@/features/auth/session-store'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  // Já autenticado: segue direto para o destino.
  beforeLoad: ({ search }) => {
    if (sessionStore.get()) throw redirect({ href: search.redirect ?? '/', replace: true })
  },
  head: () => ({ meta: [{ title: 'Entrar · Kurio' }] }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  return (
    <AuthLayout
      mode="login"
      search={search}
      title="Entrar"
      description="Entre para gerenciar sua carteira, coleção e perfil de criador."
    >
      <LoginForm search={search} />
    </AuthLayout>
  )
}
