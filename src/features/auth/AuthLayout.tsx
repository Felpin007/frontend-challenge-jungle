import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ComingSoon } from '@/components/common/ComingSoon'
import { FacebookColorIcon, GoogleIcon } from '@/components/icons/brand'
import { Container } from '@/components/layout/Container'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { nftListQueryOptions } from '@/features/catalog/queries'
import { SpotlightCard } from '@/features/catalog/SpotlightCard'
import { HeroCarousel } from '@/features/home/HeroCarousel'
import { useIsDesktop } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import type { AuthSearch } from './search'

/**
 * Login e cadastro: no desktop, modal sobre a página inicial (como no Figma);
 * no mobile, página cheia. O fundo é decorativo e fica inerte (sem foco).
 */
export function AuthLayout({
  mode,
  search,
  title,
  description,
  children,
}: {
  mode: 'login' | 'register'
  search: AuthSearch
  title: string
  description: string
  children: ReactNode
}) {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()

  if (!isDesktop) {
    // Figma "Mobile / Login" e "Mobile / Cadastro": blocos separados por 40 px
    return (
      <div className="mx-auto flex max-w-md flex-col gap-10 px-7 pt-20 pb-6">
        <p
          className="grid h-[136px] place-items-center text-[32px] leading-[42px] font-bold tracking-[0.1em]"
          aria-hidden="true"
        >
          KURIO
        </p>
        <div className="text-center">
          <h1 className={cn(mode === 'login' ? 'text-xl' : 'text-lg', 'leading-4 font-bold')}>
            {title}
          </h1>
          {/* O Figma mobile não tem texto de apoio: fica só para leitores de tela */}
          <p className="sr-only">{description}</p>
        </div>
        {children}
        <SocialButtons />
        <p className="-mt-1 text-center text-[15px] text-muted-foreground">
          {mode === 'login' ? (
            <>
              Novo na Kurio?{' '}
              <Link
                to="/cadastro"
                search={search}
                className="font-bold text-foreground underline-offset-4 hover:underline"
              >
                Crie uma conta
              </Link>
            </>
          ) : (
            <>
              Já tem uma conta?{' '}
              <Link
                to="/login"
                search={search}
                className="font-bold text-foreground underline-offset-4 hover:underline"
              >
                Entre
              </Link>
            </>
          )}
        </p>
      </div>
    )
  }

  return (
    <>
      <AuthBackdrop />
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) void navigate({ href: search.redirect ?? '/', replace: true })
        }}
      >
        <DialogContent
          overlayClassName="bg-transparent"
          className="top-[160px] max-w-[500px] translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-card p-0 pt-10 pb-0 sm:max-w-[500px] [&>button]:text-primary"
        >
          <div className="flex flex-col gap-6 px-20 pb-10">
            <div
              className="flex items-center justify-center gap-2 text-xl"
              aria-label="Escolha: entrar ou criar conta"
            >
              <Link
                to="/login"
                search={search}
                replace
                aria-current={mode === 'login' ? 'page' : undefined}
                className={cn(mode === 'login' ? 'text-brand-accent' : 'hover:text-brand-accent')}
              >
                Entrar
              </Link>
              <span className="h-6 w-px bg-primary" aria-hidden="true" />
              <Link
                to="/cadastro"
                search={search}
                replace
                aria-current={mode === 'register' ? 'page' : undefined}
                className={cn(
                  mode === 'register' ? 'text-brand-accent' : 'hover:text-brand-accent',
                )}
              >
                Criar conta
              </Link>
            </div>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="text-center text-[13px] text-foreground">
              {description}
            </DialogDescription>
            {children}
          </div>
          <div className="border-t border-border px-20 pt-0 pb-10">
            <SocialButtons divider={false} />
          </div>
          <div className="h-2.5 bg-primary" aria-hidden="true" />
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Login social está fora do escopo: os botões existem no layout, mas ficam desabilitados. */
/** `divider`: traços dos lados de "Ou continue com" (mobile); no modal a linha é a borda. */
function SocialButtons({ divider = true }: { divider?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <p
        className={cn(
          '-mb-1 flex items-center justify-center gap-3 text-sm leading-4',
          divider &&
            'before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border',
        )}
      >
        Ou continue com
      </p>
      <ComingSoon
        label="Login social indisponível na demonstração"
        className="flex h-10 items-center justify-center gap-2 border border-border text-sm"
      >
        <GoogleIcon className="size-5" /> Continuar com Google
      </ComingSoon>
      <ComingSoon
        label="Login social indisponível na demonstração"
        className="flex h-10 items-center justify-center gap-2 border border-border text-sm"
      >
        <FacebookColorIcon className="size-5" /> Continuar com Facebook
      </ComingSoon>
    </div>
  )
}

/** Fundo do modal (desktop): réplica estática da Início, como no Figma "Desktop / Login". */
function AuthBackdrop() {
  const list = useQuery(nftListQueryOptions({ page: 1, pageSize: 9, sort: 'recent', tab: 'all' }))
  const facets = list.data?.facets
  return (
    <div inert aria-hidden="true">
      <Container className="flex flex-col gap-24 pt-8">
        <HeroCarousel />
        <div className="flex gap-12">
          <div className="flex w-[310px] shrink-0 flex-col gap-6">
            <div className="flex flex-col gap-6 bg-card p-5">
              <BackdropFacets title="Coleções" items={facets?.categories} rows={9} />
              <BackdropFacets title="Rede" items={facets?.networks} rows={3} />
            </div>
            <SpotlightCard />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <div className="flex items-center justify-between text-[15px]">
              <p className="flex gap-5">
                <span className="border-b-2 border-primary pb-1 text-brand-accent">
                  Todos os NFTs
                </span>
                <span className="pb-1">Novos lançamentos</span>
                <span className="pb-1">Em alta</span>
              </p>
              <p>Ordenar por: Listados recentemente</p>
            </div>
            <div className="grid grid-cols-3 gap-8">
              {list.data
                ? list.data.items.slice(0, 6).map((nft) => <NftCard key={nft.id} nft={nft} />)
                : Array.from({ length: 6 }, (_, i) => <NftCardSkeleton key={i} />)}
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}

function BackdropFacets({
  title,
  items,
  rows,
}: {
  title: string
  items?: Array<{ id: string; label: string; count: number }>
  rows: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-bold">{title}</p>
      <ul className="flex flex-col gap-2.5 text-sm">
        {items
          ? items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 pl-1.5">
                <span className="size-4 rounded-[3px] border border-input" />
                <span className="flex-1">{item.label}</span>
                <span className="text-muted-foreground">({item.count})</span>
              </li>
            ))
          : Array.from({ length: rows }, (_, i) => (
              <li key={i} className="shimmer h-5 rounded-sm" />
            ))}
      </ul>
    </div>
  )
}
