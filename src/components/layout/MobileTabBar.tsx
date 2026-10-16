import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, User } from 'lucide-react'
import { useStoredSession } from '@/features/auth/session-store'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'
import { SearchDialog } from './SiteHeader'

/** Telas mobile com a barra inferior. No Figma, detalhe, carrinho, pagamento e login têm barra própria. */
export function showsTabBar(pathname: string) {
  return pathname === '/' || pathname.startsWith('/perfil')
}

/**
 * Recorte do botão central, extraído do vetor "Tab Bar" do Figma (152 × 95).
 * A barra é montada em três partes (laterais flexíveis + recorte fixo) para o
 * recorte manter a forma em qualquer largura de tela.
 */
const NOTCH_PATH =
  'M151.7 0C137.94 0 125.72 8.2 119.87 20.65C112.11 37.17 95.31 48.62 75.85 48.62C56.39 48.62 39.59 37.18 31.83 20.65C25.98 8.2 13.75 0 0 0V95H151.7Z'

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
      active ? 'text-brand-accent' : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="relative mx-auto h-[calc(95px+env(safe-area-inset-bottom))] max-w-[480px]">
        {/* Fundo com o recorte (sombra do Figma: y −10, desfoque 30, rgba(10,6,4,.45)) */}
        <div
          className="absolute inset-0 flex drop-shadow-[0_-10px_15px_rgb(10_6_4/0.45)]"
          aria-hidden="true"
        >
          <div className="-mr-px flex-1 rounded-tl-[29px] bg-card" />
          <svg
            viewBox="0 0 151.7 95"
            preserveAspectRatio="none"
            className="h-full w-[152px] shrink-0 fill-card"
          >
            <path d={NOTCH_PATH} />
          </svg>
          <div className="-ml-px flex-1 rounded-tr-[29px] bg-card" />
        </div>

        <div className="relative flex h-[95px] items-start pt-7">
          {/* Laterais com largura igual; o espaçamento encolhe em telas estreitas (28 px em 414) */}
          <div className="flex min-w-0 flex-1 basis-0 gap-[clamp(8px,calc((100vw-320px)/3),28px)] pl-6">
            <Link
              to="/"
              className={item(pathname === '/')}
              aria-label="Início"
              aria-current={pathname === '/' ? 'page' : undefined}
            >
              <House className="size-5 fill-current" aria-hidden="true" />
            </Link>
            <Link
              to="/perfil/favoritos"
              className={item(pathname === '/perfil/favoritos')}
              aria-label="Favoritos"
              aria-current={pathname === '/perfil/favoritos' ? 'page' : undefined}
            >
              <Heart className="size-5 fill-current" aria-hidden="true" />
            </Link>
          </div>

          {/* Botão central (65 px), metade acima da barra, como no Figma */}
          <div className="flex w-[152px] shrink-0 justify-center">
            <SearchDialog>
              <button
                type="button"
                className="-mt-[59px] grid size-[65px] place-items-center rounded-full bg-[linear-gradient(180deg,rgb(210_138_76/0.4),#d28a4c_88%),linear-gradient(#140d0a,#140d0a)] text-foreground"
                aria-label="Buscar NFTs"
              >
                <ScanLine className="size-[27px]" strokeWidth={2} aria-hidden="true" />
              </button>
            </SearchDialog>
          </div>

          <div className="flex min-w-0 flex-1 basis-0 justify-end gap-[clamp(8px,calc((100vw-320px)/3),28px)] pr-6">
            <Link
              to="/carrinho"
              className={item(pathname === '/carrinho')}
              aria-label={count ? `Carrinho, ${count} itens` : 'Carrinho vazio'}
            >
              <ShoppingCart className="size-5" aria-hidden="true" />
              {count > 0 ? (
                <span
                  className="absolute top-1 right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-0.5 text-[10px] font-medium text-primary-foreground"
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
                <User className="size-5 fill-current" aria-hidden="true" />
              </Link>
            ) : (
              <Link
                to="/login"
                search={{ redirect: href }}
                className={item(pathname === '/login')}
                aria-label="Entrar"
              >
                <User className="size-5 fill-current" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
