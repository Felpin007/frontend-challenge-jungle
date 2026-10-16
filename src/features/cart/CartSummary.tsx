import type { UseQueryResult } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Cart, Quote } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { ErrorState } from '@/components/feedback/States'
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
      <div
        className={cn(
          'flex',
          // Figma "Promo Input" (mobile): pílula de 50 px com borda, sombra e botão sobreposto
          variant === 'mobile' &&
            'h-[50px] rounded-full border border-border bg-card shadow-[0_6px_20px_rgb(10_6_4/0.45)] focus-within:border-ring',
        )}
      >
        <input
          id={inputId}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-ellipsis placeholder:text-brand-secondary',
            variant === 'desktop'
              ? 'h-10 rounded-l-[3px] border border-r-0 border-primary px-2 text-xs'
              : 'h-full rounded-l-full pr-2 pl-3 text-[13px] tracking-[-0.01em] outline-none min-[400px]:pl-4',
          )}
          data-testid="coupon-input"
        />
        <Button
          type="submit"
          disabled={apply.isPending}
          className={cn(
            'font-bold',
            variant === 'desktop'
              ? 'h-10 rounded-l-none rounded-r-[3px] px-5 text-base'
              : '-my-px -mr-px h-[50px] w-[97px] shrink-0 rounded-full bg-[linear-gradient(135deg,rgb(210_138_76/0.54),#d28a4c)] text-[15px] text-foreground hover:bg-[linear-gradient(135deg,rgb(210_138_76/0.7),#d28a4c)]',
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

/**
 * Resumo de valores ligado à consulta da cotação: skeleton enquanto carrega,
 * erro com nova tentativa quando não há cotação válida, e aviso discreto quando
 * só a atualização em segundo plano falhou (os últimos valores continuam à vista).
 */
export function QuoteSummary({
  quote,
  className,
}: {
  quote: UseQueryResult<Quote>
  className?: string
}) {
  if (quote.isError && !quote.data) {
    return (
      <ErrorState
        error={quote.error}
        title="Não foi possível calcular os valores"
        onRetry={() => void quote.refetch()}
        retrying={quote.isFetching}
        className={cn('py-6', className)}
      />
    )
  }
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {quote.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível atualizar os valores.{' '}
          <button type="button" className="underline" onClick={() => void quote.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : null}
      <QuoteTotals
        quote={quote.data}
        loading={quote.isPending}
        updating={quote.isFetching && quote.isPlaceholderData}
      />
    </div>
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
      {/* Cada par dt/dd fica em uma única div (único agrupamento válido dentro de dl). */}
      <dl className="flex flex-col gap-3 text-[15px] max-lg:leading-5">
        <div className="flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd className="text-base lg:text-lg" data-testid="quote-subtotal">
            {formatEth(quote.subtotal)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Desconto do lançamento{quote.coupon ? ` (${quote.coupon.percentOff}%)` : ''}</dt>
          <dd data-testid="quote-discount">(-) {formatEth(quote.discount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Taxa de rede</dt>
          <dd className="flex flex-col items-end">
            <span className="text-base lg:text-lg" data-testid="quote-fee">
              {formatEth(quote.networkFee)}
            </span>
            <span className="text-xs leading-4 text-brand-accent">Taxa estimada</span>
          </dd>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-border pt-4 max-lg:mt-0 max-lg:border-0 max-lg:pt-0">
          <dt className="font-bold max-lg:text-base max-lg:leading-4">Total</dt>
          <dd
            className="text-lg font-bold text-brand-accent max-lg:leading-4"
            data-testid="quote-total"
          >
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
