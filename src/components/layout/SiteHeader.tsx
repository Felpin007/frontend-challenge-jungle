import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogIn, LogOut, Search, ShoppingCart, User, Wallet, Heart } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ComingSoon } from '@/components/common/ComingSoon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useCurrentUser, useLogout } from '@/features/auth/queries'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'
import { Container } from './Container'

const MARKET_PATHS = ['/nft', '/carrinho', '/pagamento', '/pedidos']

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const href = useRouterState({ select: (s) => s.location.href })
  const [searchOpen, setSearchOpen] = useState(false)
  const inMarket = MARKET_PATHS.some((p) => pathname.startsWith(p))

  return (
    <header className="hidden lg:block">
      <Container>
        <div className="flex h-[69px] items-center justify-between border-b border-primary/30 pt-6 pb-0">
          <Link
            to="/"
            className="w-40 self-start pt-2 text-sm font-bold tracking-wide"
            aria-label="Kurio, página inicial"
          >
            KURIO
          </Link>
          <nav aria-label="Principal" className="flex h-full items-start gap-10">
            <NavItem to="/" active={pathname === '/' && !inMarket} label="Início" />
            <NavItem to="/" hash="catalogo" active={inMarket} label="Mercado" />
            <ComingSoon className="text-base">Criadores</ComingSoon>
            <ComingSoon className="text-base">Aprenda</ComingSoon>
          </nav>
          <div className="flex items-center gap-7 self-start">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-sm p-1"
              aria-label="Buscar NFTs"
            >
              <Search className="size-5" aria-hidden="true" />
            </button>
            <CartLink />
            <AccountArea redirect={href} />
          </div>
        </div>
      </Container>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}

function NavItem({
  to,
  hash,
  active,
  label,
}: {
  to: '/'
  hash?: string
  active: boolean
  label: string
}) {
  return (
    <Link
      to={to}
      hash={hash}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-full flex-col text-base',
        active ? 'font-bold text-brand-accent' : 'text-foreground hover:text-brand-accent',
      )}
    >
      {label}
      {active ? (
        <span className="absolute inset-x-0 -bottom-px h-[3px] bg-primary" aria-hidden="true" />
      ) : null}
    </Link>
  )
}

export function CartLink({ className }: { className?: string }) {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <Link
      to="/carrinho"
      className={cn('relative rounded-sm p-1', className)}
      aria-label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
    >
      <ShoppingCart className="size-6" aria-hidden="true" />
      {count > 0 ? (
        <span
          className="absolute -top-0.5 -right-1.5 grid min-w-4 place-items-center rounded-full border-2 border-background bg-primary px-0.5 text-[10px] leading-[13px] font-medium text-primary-foreground"
          aria-hidden="true"
          data-testid="cart-count"
        >
          {count}
        </span>
      ) : null}
    </Link>
  )
}

function AccountArea({ redirect }: { redirect: string }) {
  const { status, user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()

  if (status === 'anonymous') {
    return (
      <Button asChild size="sm" className="h-[35px] w-[100px] text-base">
        <Link to="/login" search={{ redirect }}>
          <LogIn className="size-5" aria-hidden="true" />
          Entrar
        </Link>
      </Button>
    )
  }

  const initials = (user?.displayName ?? '?').slice(0, 2).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-[35px] items-center gap-2 rounded-md px-1"
        aria-label={user ? `Conta de ${user.displayName}` : 'Conta'}
        data-testid="account-menu"
      >
        <Avatar className="size-8 border border-primary/50">
          {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-accent text-xs text-brand-accent">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-28 truncate text-sm">{user?.displayName ?? 'Carregando…'}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: '/perfil' })}>
          <User aria-hidden="true" /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/perfil/carteiras' })}>
          <Wallet aria-hidden="true" /> Carteiras
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/perfil/favoritos' })}>
          <Heart aria-hidden="true" /> Lista de interesse
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} data-testid="logout">
          <LogOut aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    onOpenChange(false)
    void navigate({ to: '/', search: { q: term.trim() || undefined }, hash: 'catalogo' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar no mercado</DialogTitle>
          <DialogDescription>Procure NFTs pelo nome ou pela coleção.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} role="search" className="flex gap-2">
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input
            id="global-search"
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ex.: Emerald, Nomad, Kurio Apes"
          />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
