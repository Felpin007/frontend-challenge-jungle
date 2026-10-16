import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/account/ProfilePage'

export const Route = createFileRoute('/_auth/perfil/')({
  head: () => ({ meta: [{ title: 'Meu perfil · Kurio' }] }),
  component: ProfilePage,
})
