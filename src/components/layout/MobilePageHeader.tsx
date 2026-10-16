import { useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Barra superior das telas mobile do Figma: voltar, título e ação opcional. */
export function MobilePageHeader({
  title,
  action,
  className,
  titleAs: Title = 'h1',
}: {
  title?: string
  action?: ReactNode
  className?: string
  titleAs?: 'h1' | 'p'
}) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <div className={cn('flex items-center gap-4 px-4 pt-6 pb-4 lg:hidden', className)}>
      <button
        type="button"
        onClick={() => (canGoBack ? router.history.back() : router.navigate({ to: '/' }))}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-foreground"
        aria-label="Voltar"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      {title ? (
        <Title className="flex-1 text-xl font-bold">{title}</Title>
      ) : (
        <span className="flex-1" />
      )}
      {action}
    </div>
  )
}
