import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ChangePasswordRequest,
  ConnectWalletRequest,
  ProfileUpdateRequest,
  WalletInput,
  WalletSlot,
} from '@/api/contracts'
import { profileApi, walletsApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useStoredSession } from '@/features/auth/session-store'

function useUserId() {
  const session = useStoredSession()
  return session?.userId ?? 'anonymous'
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.user.profile(userId),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: userId !== 'anonymous',
  })
}

/** Atualiza o perfil e o usuário da sessão (nome e avatar no cabeçalho). */
function useProfileMutation<TVars>(mutationFn: (vars: TVars) => ReturnType<typeof profileApi.get>) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const session = useStoredSession()
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.user.profile(userId), user)
      if (session) {
        queryClient.setQueryData(
          queryKeys.session(session.token),
          (old: { user: unknown; expiresAt: string } | undefined) => (old ? { ...old, user } : old),
        )
      }
    },
  })
}

export const useUpdateProfile = () =>
  useProfileMutation((body: ProfileUpdateRequest) => profileApi.update(body))
export const useUploadAvatar = () =>
  useProfileMutation((dataUrl: string) => profileApi.uploadAvatar(dataUrl))
export const useRemoveAvatar = () => useProfileMutation(() => profileApi.removeAvatar())

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => profileApi.changePassword(body),
  })
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.user.wallets(userId),
    queryFn: ({ signal }) => walletsApi.get({ signal }),
    enabled: userId !== 'anonymous',
  })
}

export function useSaveWallet() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slot, body }: { slot: WalletSlot; body: WalletInput }) =>
      walletsApi.save(slot, body),
    onSuccess: (wallets) => queryClient.setQueryData(queryKeys.user.wallets(userId), wallets),
  })
}

export function useRemoveSecondaryWallet() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => walletsApi.removeSecondary(),
    onSuccess: (wallets) => queryClient.setQueryData(queryKeys.user.wallets(userId), wallets),
  })
}

/** Sessão de carteira conectada (simulada no servidor). */
export function useWalletSession() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.user.walletSessions(userId),
    queryFn: async ({ signal }) => (await walletsApi.sessions({ signal })).items[0] ?? null,
    enabled: userId !== 'anonymous',
    staleTime: Infinity,
  })
}

export function useConnectWallet() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ConnectWalletRequest) => walletsApi.connect(body),
    onSuccess: (session) =>
      queryClient.setQueryData(queryKeys.user.walletSessions(userId), session),
  })
}

export function useDisconnectWallet() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => walletsApi.disconnect(id),
    onSettled: () => queryClient.setQueryData(queryKeys.user.walletSessions(userId), null),
  })
}
