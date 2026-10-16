import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ComingSoon } from '@/components/common/ComingSoon'
import { FacebookColorIcon, GoogleIcon } from '@/components/icons/brand'
import { Container } from '@/components/layout/Container'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { nftListQueryOptions } from '@/features/catalog/queries'
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
    return (
      <div className="mx-auto flex max-w-md flex-col gap-10 px-6 pt-16 pb-10">
        <p className="text-center text-[32px] font-bold tracking-widest" aria-hidden="true">
          KURIO
        </p>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
          <SocialButtons />
          <p className="text-center text-[15px] text-muted-foreground">
            {mode === 'login' ? (
              <>
                Novo na Kurio?{' '}
                <Link
                  to="/cadastro"
                  search={search}
                  className="text-foreground underline-offset-4 hover:underline"
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
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Entre
                </Link>
              </>
            )}
          </p>
        </div>
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
        <DialogContent className="max-w-[500px] gap-0 overflow-hidden rounded-none border-0 bg-card p-0 pt-10 pb-0 sm:max-w-[500px] [&>button]:text-primary">
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
            <DialogDescription className="text-center text-sm text-foreground">
              {description}
            </DialogDescription>
            {children}
          </div>
          <div className="border-t border-border px-20 pt-0 pb-10">
            <SocialButtons />
          </div>
          <div className="h-2.5 bg-primary" aria-hidden="true" />
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Login social está fora do escopo: os botões existem no layout, mas ficam desabilitados. */
function SocialButtons() {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-3 text-sm before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
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

function AuthBackdrop() {
  const list = useQuery(nftListQueryOptions({ page: 1, pageSize: 9, sort: 'recent', tab: 'all' }))
  return (
    <div inert aria-hidden="true">
      <Container className="flex flex-col gap-24 pt-8">
        <HeroCarousel />
        <div className="ml-[358px] grid grid-cols-3 gap-8">
          {list.data
            ? list.data.items.slice(0, 6).map((nft) => <NftCard key={nft.id} nft={nft} />)
            : Array.from({ length: 6 }, (_, i) => <NftCardSkeleton key={i} />)}
        </div>
      </Container>
    </div>
  )
}
