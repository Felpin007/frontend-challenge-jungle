import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest, Session } from '@/api/contracts'
import { authApi, cartApi } from '@/api/endpoints'
import { getGuestCartId, resetGuestCartId } from '@/api/http'
import { queryKeys } from '@/api/query-keys'
import { sessionStore, useStoredSession } from './session-store'

export const sessionQueryOptions = (token: string) =>
  queryOptions({
    queryKey: queryKeys.session(token),
    queryFn: ({ signal }) => authApi.session({ signal }),
    staleTime: 60_000,
  })

/** Usuário atual. `status` diferencia visitante, sessão carregando e autenticado. */
export function useCurrentUser() {
  const stored = useStoredSession()
  const query = useQuery({
    ...sessionQueryOptions(stored?.token ?? ''),
    enabled: Boolean(stored),
  })
  if (!stored) return { status: 'anonymous' as const, user: null, userId: null }
  if (!query.data) return { status: 'loading' as const, user: null, userId: stored.userId }
  return { status: 'authenticated' as const, user: query.data.user, userId: stored.userId }
}

/**
 * Após autenticar: salva a sessão, preenche o cache e junta o carrinho do
 * visitante ao carrinho da conta (itens do visitante são preservados).
 */
function useStartSession() {
  const queryClient = useQueryClient()
  return async (session: Session) => {
    queryClient.setQueryData(queryKeys.session(session.token), {
      user: session.user,
      expiresAt: session.expiresAt,
    })
    sessionStore.set({
      token: session.token,
      userId: session.user.id,
      expiresAt: session.expiresAt,
    })
    try {
      const merged = await cartApi.merge(getGuestCartId())
      queryClient.setQueryData(queryKeys.cart.byOwner(`user:${session.user.id}`), merged)
    } catch {
      // Falha ao juntar não impede o login: o carrinho do visitante continua no servidor
      // e será juntado no próximo login.
      return
    }
    resetGuestCartId()
  }
}

export function useLogin() {
  const start = useStartSession()
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: start,
  })
}

export function useRegister() {
  const start = useStartSession()
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: start,
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } finally {
        // Mesmo se a chamada falhar, a sessão local termina.
        sessionStore.clear('logout')
      }
    },
  })
}
