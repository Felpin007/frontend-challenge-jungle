import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/api/contracts'
import { favoritesApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useStoredSession } from '@/features/auth/session-store'

export function useFavorites() {
  const session = useStoredSession()
  return useQuery({
    queryKey: queryKeys.user.favorites(session?.userId ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: Boolean(session),
  })
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites()
  return data?.nftIds.includes(nftId) ?? false
}

/**
 * Favoritar com atualização otimista: o coração muda na hora e, se a API
 * falhar, voltamos ao estado anterior (rollback) e avisamos o usuário.
 */
export function useToggleFavorite() {
  const session = useStoredSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })

  const mutation = useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      const key = queryKeys.user.favorites(session?.userId ?? 'anonymous')
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = old?.nftIds ?? []
        return {
          nftIds: favorite ? [...new Set([...ids, nftId])] : ids.filter((id) => id !== nftId),
        }
      })
      return { previous, key }
    },
    onError: (_error, { favorite, name }, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
      toast.error(
        favorite
          ? `Não foi possível favoritar ${name}. Tente novamente.`
          : `Não foi possível remover ${name} dos favoritos. Tente novamente.`,
      )
    },
    onSuccess: (data, { favorite, name }, context) => {
      queryClient.setQueryData(context.key, data)
      toast.success(
        favorite ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.user.favoriteItems(session?.userId ?? 'anonymous'),
      })
    },
  })

  return {
    ...mutation,
    toggle(nftId: string, name: string, currentlyFavorite: boolean) {
      if (!session) {
        toast.info('Entre na sua conta para salvar favoritos.')
        void navigate({ to: '/login', search: { redirect: location.href } })
        return
      }
      mutation.mutate({ nftId, favorite: !currentlyFavorite, name })
    },
  }
}
