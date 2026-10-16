import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export function EthPrice({
  value,
  compareAt,
  className,
}: {
  value: string
  compareAt?: string | null
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-3', className)}>
      <span className="font-bold text-brand-accent">{formatEth(value)}</span>
      {compareAt ? (
        <span className="font-normal text-brand-secondary line-through">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(compareAt)}
        </span>
      ) : null}
    </span>
  )
}
