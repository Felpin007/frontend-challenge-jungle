import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, House, ScanSearch, ShoppingCart, User } from 'lucide-react'
import { useStoredSession } from '@/features/auth/session-store'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'
import { SearchDialog } from './SiteHeader'

/** Telas mobile com a barra inferior. No Figma, detalhe, carrinho, pagamento e login têm barra própria. */
export function showsTabBar(pathname: string) {
  return pathname === '/' || pathname.startsWith('/perfil')
}

/** Navegação inferior do layout mobile (Figma "Mobile / Início"). */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const href = useRouterState({ select: (s) => s.location.href })
  const session = useStoredSession()
  const { data: cart } = useCart()
  const count = cart?.itemCount ?? 0
  if (!showsTabBar(pathname)) return null

  const item = (active: boolean) =>
    cn(
      'relative grid size-11 place-items-center rounded-full',
      active ? 'text-primary' : 'text-brand-secondary hover:text-foreground',
    )

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="relative mx-auto flex h-[72px] max-w-[480px] items-center justify-between rounded-t-[32px] bg-card px-6 shadow-[0_-8px_24px_rgb(0_0_0/0.35)]">
        <Link
          to="/"
          className={item(pathname === '/')}
          aria-label="Início"
          aria-current={pathname === '/' ? 'page' : undefined}
        >
          <House className="size-6 fill-current" aria-hidden="true" />
        </Link>
        <Link
          to="/perfil/favoritos"
          className={item(pathname === '/perfil/favoritos')}
          aria-label="Favoritos"
        >
          <Heart className="size-6 fill-current" aria-hidden="true" />
        </Link>
        <SearchDialog>
          <button
            type="button"
            className="-mt-12 grid size-16 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg"
            aria-label="Buscar NFTs"
          >
            <ScanSearch className="size-7" aria-hidden="true" />
          </button>
        </SearchDialog>
        <Link
          to="/carrinho"
          className={item(pathname === '/carrinho')}
          aria-label={count ? `Carrinho, ${count} itens` : 'Carrinho vazio'}
        >
          <ShoppingCart className="size-6" aria-hidden="true" />
          {count > 0 ? (
            <span
              className="absolute top-1 right-0 grid min-w-4 place-items-center rounded-full bg-primary px-0.5 text-[10px] font-medium text-primary-foreground"
              aria-hidden="true"
            >
              {count}
            </span>
          ) : null}
        </Link>
        {session ? (
          <Link
            to="/perfil"
            className={item(pathname.startsWith('/perfil') && pathname !== '/perfil/favoritos')}
            aria-label="Meu perfil"
          >
            <User className="size-6 fill-current" aria-hidden="true" />
          </Link>
        ) : (
          <Link
            to="/login"
            search={{ redirect: href }}
            className={item(pathname === '/login')}
            aria-label="Entrar"
          >
            <User className="size-6 fill-current" aria-hidden="true" />
          </Link>
        )}
      </div>
    </nav>
  )
}
