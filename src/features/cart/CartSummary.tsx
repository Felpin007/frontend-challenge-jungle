import { Loader2, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Cart, Quote } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useRemoveCoupon } from './queries'

/** Campo de cupom: aplica/remove na API e mostra erros de código inválido ou expirado. */
export function CouponForm({
  cart,
  variant = 'desktop',
}: {
  cart: Cart
  variant?: 'desktop' | 'mobile'
}) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = code.trim()
    if (!value) {
      setError('Informe um código promocional.')
      return
    }
    setError(null)
    apply.mutate(value, {
      onSuccess: () => {
        setCode('')
        toast.success(`Cupom ${value.toUpperCase()} aplicado.`)
      },
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : 'Não foi possível aplicar o cupom.'),
    })
  }

  if (cart.couponCode) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-primary/50 px-3 py-2 text-sm">
        <span>
          Cupom <strong className="text-brand-accent">{cart.couponCode}</strong> aplicado
        </span>
        <button
          type="button"
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => toast.info('Cupom removido.'),
              onError: () => toast.error('Não foi possível remover o cupom.'),
            })
          }
          disabled={remove.isPending}
          className="inline-flex items-center gap-1 text-brand-accent hover:underline"
        >
          <X className="size-4" aria-hidden="true" /> Remover
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className={cn('text-sm font-bold', variant === 'mobile' && 'sr-only')}
      >
        Código promocional
      </label>
      <div className={cn('flex', variant === 'mobile' && 'rounded-full bg-background p-1')}>
        <input
          id={inputId}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-10 min-w-0 flex-1 bg-transparent px-2 placeholder:text-brand-secondary',
            variant === 'desktop' ? 'rounded-l-[3px] border border-r-0 border-primary text-xs' : 'px-4 text-sm',
          )}
          data-testid="coupon-input"
        />
        <Button
          type="submit"
          disabled={apply.isPending}
          className={cn(
            'h-10 px-5 text-base font-bold',
            variant === 'desktop'
              ? 'rounded-l-none rounded-r-[3px]'
              : 'h-11 rounded-full bg-linear-to-r from-primary to-[#b8743d]',
          )}
        >
          {apply.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Aplicar
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}

/** Subtotal, desconto, taxa e total exatamente como devolvidos pela cotação da API. */
export function QuoteTotals({
  quote,
  loading,
  updating,
  className,
}: {
  quote?: Quote
  loading: boolean
  updating?: boolean
  className?: string
}) {
  if (loading || !quote) {
    return (
      <div
        className={cn('flex flex-col gap-4', className)}
        aria-busy="true"
        data-testid="quote-skeleton"
      >
        <p className="sr-only" role="status">
          Calculando valores…
        </p>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between" aria-hidden="true">
            <div className="shimmer h-5 w-28 rounded-sm" />
            <div className="shimmer h-5 w-20 rounded-sm" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div
      className={cn('flex flex-col gap-3 transition-opacity', updating && 'opacity-60', className)}
      aria-busy={updating}
      data-testid="quote-totals"
    >
      {quote.couponStatus === 'expired' || quote.couponStatus === 'invalid' ? (
        <p role="alert" className="text-sm text-amber">
          O cupom salvo {quote.couponStatus === 'expired' ? 'expirou' : 'não é mais válido'} e não
          foi aplicado.
        </p>
      ) : null}
      <dl className="flex flex-col gap-3 text-[15px]">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="text-lg" data-testid="quote-subtotal">
            {formatEth(quote.subtotal)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Desconto do lançamento{quote.coupon ? ` (${quote.coupon.percentOff}%)` : ''}</dt>
          <dd data-testid="quote-discount">(-) {formatEth(quote.discount)}</dd>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd className="text-lg" data-testid="quote-fee">
              {formatEth(quote.networkFee)}
            </dd>
          </div>
          <p className="self-end text-xs text-brand-accent">Taxa estimada</p>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-4">
          <dt className="font-bold">Total</dt>
          <dd className="text-lg font-bold text-brand-accent" data-testid="quote-total">
            {formatEth(quote.total)}
          </dd>
        </div>
      </dl>
      <p className="sr-only" aria-live="polite">
        {updating ? 'Atualizando valores' : `Total: ${formatEth(quote.total)}`}
      </p>
    </div>
  )
}
