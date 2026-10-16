import { createFileRoute } from '@tanstack/react-router'
import { authSearchSchema } from '@/features/auth/search'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  component: () => <main className="p-8">Login</main>,
})
