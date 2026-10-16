import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import type { RouterContext } from '@/app/router'
import { Deferred } from '@/components/common/Deferred'
import { ConnectionBanner } from '@/components/feedback/ConnectionBanner'
import { NotFoundPage } from '@/components/feedback/NotFoundPage'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { config } from '@/config'
import { AuthWatcher } from '@/features/auth/AuthWatcher'
import { RealtimeProvider } from '@/realtime/RealtimeProvider'

// Painel de cenários: faz parte da camada de mocks e só existe quando ela está ligada.
const MockPanel = config.enableMocks ? lazy(() => import('@/mocks/panel/MockPanel')) : null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <NotFoundPage />,
})

/** Telas sem rodapé (fluxos focados, como no Figma). */
const NO_FOOTER = ['/pagamento', '/pedidos', '/perfil']
/** No mobile essas telas são estilo app, sem rodapé (Figma). */
const NO_FOOTER_MOBILE = ['/login', '/cadastro', '/carrinho', '/nft/']

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const showFooter = !NO_FOOTER.some((p) => pathname.startsWith(p))
  const hideFooterOnMobile = NO_FOOTER_MOBILE.some((p) => pathname.startsWith(p))
  return (
    <TooltipProvider delayDuration={200}>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <HeadContent />
      <AuthWatcher />
      <RealtimeProvider />
      <SiteHeader />
      <ConnectionBanner />
      <main id="conteudo" tabIndex={-1} className="min-h-dvh pb-28 outline-none lg:pb-0">
        <Outlet />
      </main>
      {showFooter ? (
        <Deferred minHeight={640}>
          <SiteFooter className={hideFooterOnMobile ? 'max-lg:hidden' : undefined} />
        </Deferred>
      ) : null}
      <MobileTabBar />
      <Toaster position="top-center" closeButton />
      {MockPanel ? (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      ) : null}
    </TooltipProvider>
  )
}
