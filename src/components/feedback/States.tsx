import { CircleAlert, RefreshCw, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.') {
  if (error instanceof ApiError) return error.message
  return fallback
}

export function ErrorState({
  error,
  onRetry,
  title = 'Não foi possível carregar',
  className,
  retrying,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
  retrying?: boolean
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-md border border-border bg-card px-6 py-10 text-center',
        className,
      )}
    >
      <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
      <p className="font-bold">{title}</p>
      <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden="true" />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      {icon ?? <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />}
      <p className="font-bold">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}
