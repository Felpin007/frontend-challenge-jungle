import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { RouterContext } from '@/app/router'
import { Toaster } from '@/components/ui/sonner'
import { AuthWatcher } from '@/features/auth/AuthWatcher'
import { RealtimeProvider } from '@/realtime/RealtimeProvider'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <AuthWatcher />
      <RealtimeProvider />
      <Outlet />
      <Toaster position="bottom-right" richColors={false} closeButton />
    </>
  )
}
