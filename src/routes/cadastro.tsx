import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { RegisterForm } from '@/features/auth/AuthForms'
import { authSearchSchema } from '@/features/auth/search'
import { sessionStore } from '@/features/auth/session-store'
import { useIsDesktop } from '@/hooks/use-media-query'

export const Route = createFileRoute('/cadastro')({
  validateSearch: authSearchSchema,
  beforeLoad: ({ search }) => {
    if (sessionStore.get()) throw redirect({ href: search.redirect ?? '/', replace: true })
  },
  head: () => ({ meta: [{ title: 'Criar conta · Kurio' }] }),
  component: RegisterPage,
})

function RegisterPage() {
  const search = Route.useSearch()
  const isDesktop = useIsDesktop()
  return (
    <AuthLayout
      mode="register"
      search={search}
      title={isDesktop ? 'Criar conta' : 'Criar perfil de colecionador'}
      description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
    >
      <RegisterForm search={search} submitLabel={isDesktop ? 'Criar conta' : 'Criar perfil'} />
    </AuthLayout>
  )
}
