import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { queryKeys } from '@/api/query-keys'
import { sessionStore, useStoredSession } from './session-store'

/**
 * Reage a mudanças de sessão (login, logout, troca de usuário, expiração):
 * - remove do cache todos os dados privados da sessão anterior;
 * - na expiração, avisa e leva ao login preservando a página atual para retomar.
 * A conexão Socket.IO é refeita pelo RealtimeProvider, que depende do mesmo token.
 */
export function AuthWatcher() {
  const session = useStoredSession()
  const queryClient = useQueryClient()
  const router = useRouter()
  const previousToken = useRef(session?.token ?? null)

  useEffect(() => {
    const token = session?.token ?? null
    if (token === previousToken.current) return
    const hadSession = previousToken.current !== null
    previousToken.current = token

    if (hadSession) {
      void queryClient.cancelQueries({ queryKey: queryKeys.user.all })
      queryClient.removeQueries({ queryKey: queryKeys.user.all })
      queryClient.removeQueries({ queryKey: queryKeys.cart.all })
      queryClient.removeQueries({ queryKey: ['session'] })
    }

    if (!token && sessionStore.lastEndReason() === 'expired') {
      toast.warning('Sua sessão expirou. Entre novamente para continuar de onde parou.')
      const { pathname, searchStr } = router.state.location
      void router.navigate({
        to: '/login',
        search: { redirect: `${pathname}${searchStr}`, reason: 'expired' },
        replace: true,
      })
    } else {
      // Revalida os guards da rota atual (ex.: logout dentro de uma página privada).
      void router.invalidate()
    }
  }, [session?.token, queryClient, router])

  return null
}
