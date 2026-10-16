import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '@/features/account/FavoritesPage'

export const Route = createFileRoute('/_auth/perfil/favoritos')({
  head: () => ({ meta: [{ title: 'Lista de interesse · Kurio' }] }),
  component: FavoritesPage,
})
