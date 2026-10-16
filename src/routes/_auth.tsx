import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ApiError } from '@/api/http'
import { sessionQueryOptions } from '@/features/auth/queries'
import { sessionStore } from '@/features/auth/session-store'

/**
 * Layout sem caminho que protege as rotas privadas (checkout, pedidos, perfil,
 * carteiras, favoritos). Valida a sessão na API antes de renderizar; sem sessão
 * válida, manda para o login guardando a URL atual em `redirect`.
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    const session = sessionStore.get()
    const target = { to: '/login' as const, search: { redirect: location.href }, replace: true }
    if (!session) {
      // A sessão pode ter expirado numa requisição em segundo plano antes desta navegação.
      const expired = sessionStore.lastEndReason() === 'expired'
      throw redirect(
        expired ? { ...target, search: { ...target.search, reason: 'expired' as const } } : target,
      )
    }
    try {
      const info = await context.queryClient.ensureQueryData(sessionQueryOptions(session.token))
      return { user: info.user }
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHENTICATED')
      ) {
        sessionStore.clear('expired')
        throw redirect({ ...target, search: { ...target.search, reason: 'expired' as const } })
      }
      throw error
    }
  },
  component: Outlet,
})
