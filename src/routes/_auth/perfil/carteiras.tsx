import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/account/WalletsPage'

export const Route = createFileRoute('/_auth/perfil/carteiras')({
  head: () => ({ meta: [{ title: 'Carteiras · Kurio' }] }),
  component: WalletsPage,
})
