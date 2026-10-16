import { useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Botão circular de voltar das telas mobile do Figma (35 px, borda e seta discretas). */
export function MobileBackButton({ className }: { className?: string }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <button
      type="button"
      onClick={() => (canGoBack ? router.history.back() : router.navigate({ to: '/' }))}
      className={cn(
        'grid size-[35px] shrink-0 place-items-center rounded-full border border-border bg-secondary text-brand-secondary hover:text-foreground',
        className,
      )}
      aria-label="Voltar"
    >
      <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}

/** Barra superior das telas mobile do Figma: voltar, título e ação opcional. */
export function MobilePageHeader({
  title,
  action,
  className,
  titleAs: Title = 'h1',
  centerTitle = false,
}: {
  title?: string
  action?: ReactNode
  className?: string
  titleAs?: 'h1' | 'p'
  /** Título centralizado (Figma "Mobile / Carrinho de NFTs"). */
  centerTitle?: boolean
}) {
  return (
    <div className={cn('flex min-h-11 items-center gap-6 px-7 pt-8 pb-3 lg:hidden', className)}>
      <MobileBackButton />
      {title ? (
        <Title
          className={cn(
            'flex-1 text-xl leading-5 font-bold',
            centerTitle && 'pr-[59px] text-center',
          )}
        >
          {title}
        </Title>
      ) : (
        <span className="flex-1" />
      )}
      {action}
    </div>
  )
}
