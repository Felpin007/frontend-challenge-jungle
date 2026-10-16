import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Seletor de quantidade inteira. "−" fica desabilitado no mínimo e "+" no
 * máximo, com o valor anunciado para leitores de tela.
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const button = cn(
    'grid place-items-center rounded-full bg-primary text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-40',
    size === 'sm' ? 'size-[19px]' : 'h-[47px] w-[31px] rounded-[16px]',
  )
  return (
    <div role="group" aria-label={label} className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Diminuir quantidade de ${label}`}
      >
        <Minus className={size === 'sm' ? 'size-3' : 'size-5'} aria-hidden="true" />
      </button>
      <output
        aria-live="polite"
        aria-label={`Quantidade: ${value}`}
        className="min-w-5 text-center text-lg tabular-nums"
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
      >
        <Plus className={size === 'sm' ? 'size-3' : 'size-5'} aria-hidden="true" />
      </button>
    </div>
  )
}
