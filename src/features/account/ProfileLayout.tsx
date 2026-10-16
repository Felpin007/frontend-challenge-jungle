import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  CircleAlert,
  Download,
  Heart,
  LogOut,
  MapPin,
  ShoppingCart,
  User,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { ComingSoon } from '@/components/common/ComingSoon'
import { Container } from '@/components/layout/Container'
import { MobilePageHeader } from '@/components/layout/MobilePageHeader'
import { useLogout } from '@/features/auth/queries'
import { cn } from '@/lib/utils'

const TITLES: Record<string, string> = {
  '/perfil': 'Dados do perfil',
  '/perfil/carteiras': 'Carteiras',
  '/perfil/favoritos': 'Lista de interesse',
}

export function ProfileLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, '') })
  const logout = useLogout()

  return (
    <div>
      <MobilePageHeader title={TITLES[pathname] ?? 'Meu perfil'} />
      <Container className="flex flex-col gap-7 lg:flex-row lg:pt-8">
        <nav aria-label="Meu perfil" className="shrink-0 bg-card lg:w-[310px] lg:self-start">
          <p className="hidden px-2.5 pt-5 pb-2 text-lg font-bold lg:block">Meu perfil</p>
          <ul className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0 lg:p-0">
            <NavItem to="/perfil" active={pathname === '/perfil'} icon={<User />}>
              Dados do perfil
            </NavItem>
            <NavItem
              to="/perfil/carteiras"
              active={pathname === '/perfil/carteiras'}
              icon={<MapPin />}
            >
              Carteiras
            </NavItem>
            <SoonItem icon={<ShoppingCart />}>Atividade</SoonItem>
            <NavItem
              to="/perfil/favoritos"
              active={pathname === '/perfil/favoritos'}
              icon={<Heart />}
            >
              Lista de interesse
            </NavItem>
            <SoonItem icon={<Activity />}>Ofertas</SoonItem>
            <SoonItem icon={<Download />}>Arquivos baixados</SoonItem>
            <SoonItem icon={<CircleAlert />}>Suporte</SoonItem>
            <li className="shrink-0 lg:border-t lg:border-border">
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="flex h-11 w-full items-center gap-3 px-4 font-bold whitespace-nowrap text-brand-accent hover:bg-accent [&_svg]:size-5"
                data-testid="profile-logout"
              >
                <LogOut aria-hidden="true" /> Sair
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0 flex-1 pb-16">
          <Outlet />
        </div>
      </Container>
    </div>
  )
}

function NavItem({
  to,
  active,
  icon,
  children,
}: {
  to: '/perfil' | '/perfil/carteiras' | '/perfil/favoritos'
  active: boolean
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <li className="shrink-0">
      <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-11 items-center gap-3 border-l-[6px] px-4 whitespace-nowrap text-brand-accent [&_svg]:size-5',
          active ? 'border-primary bg-accent/40' : 'border-transparent hover:bg-accent',
        )}
      >
        <span aria-hidden="true">{icon}</span>
        {children}
      </Link>
    </li>
  )
}

function SoonItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="hidden shrink-0 lg:block">
      <ComingSoon className="flex h-11 w-full items-center gap-3 px-[22px] text-brand-accent [&_svg]:size-5">
        <span aria-hidden="true">{icon}</span>
        {children}
      </ComingSoon>
    </li>
  )
}
