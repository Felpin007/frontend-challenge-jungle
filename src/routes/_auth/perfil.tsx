import { createFileRoute } from '@tanstack/react-router'
import { ProfileLayout } from '@/features/account/ProfileLayout'

export const Route = createFileRoute('/_auth/perfil')({
  component: ProfileLayout,
})
