import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Seletor de quantidade inteira. "−" fica desabilitado no mínimo e "+" no
 * máximo, com o valor anunciado para leitores de tela. No máximo, `maxHint`
 * explica por que não dá para aumentar (ex.: edição única ou estoque).
 *
 * Variantes do Figma: `solid` (círculos laranja, desktop e barra do detalhe) e
 * `outline` (círculos escuros com borda, carrinho mobile).
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
  variant = 'solid',
  maxHint,
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  /** bar: botões em pílula de 20 × 30 px (barra de compra mobile do Figma). */
  size?: 'sm' | 'md' | 'bar'
  variant?: 'solid' | 'outline'
  maxHint?: string
  className?: string
}) {
  const hintId = useId()
  const atMax = value >= max
  const showHint = Boolean(maxHint) && atMax && !disabled
  const button = cn(
    'grid place-items-center rounded-full transition disabled:cursor-not-allowed',
    variant === 'solid'
      ? 'bg-primary text-primary-foreground disabled:opacity-40'
      : 'border border-border bg-secondary text-foreground disabled:text-[#55321f]',
    variant === 'outline'
      ? 'size-6'
      : size === 'sm'
        ? 'size-[19px]'
        : size === 'bar'
          ? 'h-[30px] w-5 rounded-[20px] border border-background text-black shadow-[0_2px_6px_rgb(10_6_4/0.45)]'
          : 'h-[50px] w-[33px] rounded-full border border-background shadow-[0_2px_6px_rgb(10_6_4/0.45)]',
  )
  const icon =
    variant === 'outline'
      ? 'size-3.5'
      : size === 'sm'
        ? 'size-3'
        : size === 'bar'
          ? 'size-3.5'
          : 'size-5'
  return (
    <div className={cn('flex flex-col items-end gap-1 lg:items-start', className)}>
      <div
        role="group"
        aria-label={label}
        aria-describedby={showHint ? hintId : undefined}
        className={cn('flex items-center', variant === 'outline' ? 'gap-[11px]' : 'gap-3')}
      >
        <button
          type="button"
          className={button}
          onClick={() => onChange(value - 1)}
          disabled={disabled || value <= min}
          aria-label={`Diminuir quantidade de ${label}`}
        >
          <Minus
            className={icon}
            strokeWidth={variant === 'outline' ? 2.5 : 2}
            aria-hidden="true"
          />
        </button>
        <output
          aria-live="polite"
          aria-label={`Quantidade: ${value}`}
          className={cn(
            'text-center tabular-nums',
            variant === 'outline'
              ? 'min-w-2.5 text-base'
              : size === 'bar'
                ? 'min-w-3 text-lg font-medium'
                : 'min-w-5 text-xl',
          )}
        >
          {value}
        </output>
        <button
          type="button"
          className={button}
          onClick={() => onChange(value + 1)}
          disabled={disabled || atMax}
          aria-label={`Aumentar quantidade de ${label}`}
        >
          <Plus className={icon} strokeWidth={variant === 'outline' ? 2.5 : 2} aria-hidden="true" />
        </button>
      </div>
      {showHint ? (
        <p id={hintId} className="text-[11px] leading-none whitespace-nowrap text-muted-foreground">
          {maxHint}
        </p>
      ) : null}
    </div>
  )
}

/** Texto do limite: explica por que o "+" está desabilitado. */
export function quantityLimitHint({ max, editionLabel }: { max: number; editionLabel?: string }) {
  if (editionLabel === '1/1') return 'Edição única'
  return `Máx. ${max} ${max === 1 ? 'unidade' : 'unidades'}`
}
