import { Link, useNavigate } from '@tanstack/react-router'
import { ShoppingCart, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { toast } from 'sonner'
import type { Cart, CartItem } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { QuantityStepper, quantityLimitHint } from '@/components/common/QuantityStepper'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { Container } from '@/components/layout/Container'
import { MobilePageHeader } from '@/components/layout/MobilePageHeader'
import { NftImage } from '@/components/nft/NftImage'
import { Button } from '@/components/ui/button'
import { RelatedNfts } from '@/features/nft/RelatedNfts'
import { useElementHeight } from '@/hooks/use-element-height'
import { useIsDesktop } from '@/hooks/use-media-query'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { CouponForm, QuoteSummary, QuoteTotals } from './CartSummary'
import {
  useAcknowledgeCart,
  useCart,
  useQuote,
  useRemoveCartItem,
  useUpdateCartItem,
} from './queries'

export function hasBlockingIssues(cart: Cart) {
  return cart.items.some((i) => i.status === 'sold_out' || i.status === 'insufficient')
}

export function CartPage() {
  const isDesktop = useIsDesktop()
  const cart = useCart()
  const quote = useQuote('ethereum', cart.data)
  const navigate = useNavigate()
  // Mobile: o resumo é um painel fixo no rodapé (Figma); a lista reserva espaço para ele.
  const [summaryRef, summaryHeight] = useElementHeight<HTMLElement>()

  const data = cart.data
  const blocking = data ? hasBlockingIssues(data) : false
  const quoteUpdating = quote.isFetching && quote.isPlaceholderData

  let body: React.ReactNode
  if (cart.isPending) {
    body = <CartSkeleton />
  } else if (cart.isError && !data) {
    body = (
      <ErrorState
        error={cart.error}
        title="Não foi possível carregar o carrinho"
        onRetry={() => void cart.refetch()}
        retrying={cart.isFetching}
      />
    )
  } else if (data && data.items.length === 0) {
    body = (
      <EmptyState
        icon={<ShoppingCart className="size-8 text-muted-foreground" aria-hidden="true" />}
        title="Seu carrinho está vazio"
        description="Explore o mercado e adicione NFTs para continuar."
        action={
          <Button asChild>
            <Link to="/" hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        }
      />
    )
  } else if (data) {
    body = (
      <div
        className="flex flex-col gap-8 lg:flex-row lg:gap-[86px] sheet-fixed:pb-(--summary-h)"
        style={{ '--summary-h': `${summaryHeight + 16}px` } as CSSProperties}
      >
        <div className="flex flex-1 flex-col gap-3">
          <PriceChangeNotice cart={data} />
          <div
            className="hidden grid-cols-[311px_139px_136px_minmax(0,1fr)_40px] border-b border-border pb-3 font-bold lg:grid"
            aria-hidden="true"
          >
            <span>NFTs</span>
            <span>Preço</span>
            <span>Edições</span>
            <span>Total</span>
          </div>
          <ul className="flex flex-col gap-5 lg:gap-3" aria-label="Itens do carrinho">
            {data.items.map((item) => (
              <CartRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
        <aside
          ref={summaryRef}
          aria-labelledby="summary-title"
          className={cn(
            // Mobile (Figma "Payment Summary"): painel de ponta a ponta, cantos superiores de 40 px
            '-mx-7 flex flex-col gap-3 rounded-t-[40px] bg-card px-6 pt-6 pb-9',
            'sheet-fixed:fixed sheet-fixed:inset-x-0 sheet-fixed:bottom-0 sheet-fixed:z-30 sheet-fixed:mx-0 sheet-fixed:max-h-[70dvh] sheet-fixed:overflow-y-auto',
            'lg:mx-0 lg:w-[332px] lg:gap-5 lg:rounded-none lg:bg-transparent lg:p-0',
          )}
        >
          <h2
            id="summary-title"
            className="border-b border-border pb-3 text-lg font-bold max-lg:sr-only"
          >
            Resumo da carteira
          </h2>
          <CouponForm cart={data} variant={isDesktop ? 'desktop' : 'mobile'} />
          <QuoteSummary quote={quote} />
          {blocking ? (
            <p role="alert" className="text-sm text-amber">
              Ajuste os itens esgotados ou com estoque insuficiente para continuar.
            </p>
          ) : null}
          <Button
            className="mt-5 h-[60px] rounded-full bg-[linear-gradient(130deg,#d28a4c,rgb(210_138_76/0.8))] text-base font-bold lg:mt-0 lg:h-10 lg:rounded-[3px] lg:bg-primary lg:bg-none"
            disabled={blocking || !quote.data || quote.isError || quoteUpdating}
            onClick={() => void navigate({ to: '/pagamento' })}
            data-testid="checkout-button"
          >
            Conectar e finalizar
          </Button>
          <Link
            to="/"
            hash="catalogo"
            className="text-center text-[15px] text-brand-accent hover:underline max-lg:hidden"
          >
            Continuar explorando
          </Link>
        </aside>
      </div>
    )
  }

  return (
    <div>
      <MobilePageHeader title="Carrinho de NFTs" centerTitle />
      <Container className="flex flex-col gap-16 max-lg:px-7 lg:pt-8">
        <div className="flex flex-col gap-3">
          <nav aria-label="Trilha de navegação" className="hidden text-[15px] font-bold lg:block">
            <ol className="flex gap-2">
              <li>
                <Link to="/" className="hover:text-brand-accent">
                  Início
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link to="/" hash="catalogo" className="hover:text-brand-accent">
                  Mercado
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">Carrinho</li>
            </ol>
          </nav>
          <h1 className="sr-only max-lg:hidden">Carrinho de NFTs</h1>
          {body}
        </div>
        <div className="hidden lg:block">
          <RelatedNfts title="Colecionadores também viram" />
        </div>
      </Container>
    </div>
  )
}

function PriceChangeNotice({ cart }: { cart: Cart }) {
  const acknowledge = useAcknowledgeCart()
  const changed = cart.items.filter((i) => i.status === 'price_changed')
  if (!changed.length) return null
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-amber/50 bg-amber/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      data-testid="price-change-notice"
    >
      <p>
        {changed.length === 1
          ? `O preço de ${changed[0].name} mudou enquanto ele estava no carrinho. O resumo já usa o valor atualizado.`
          : `${changed.length} itens mudaram de preço. O resumo já usa os valores atualizados.`}
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => acknowledge.mutate()}
        disabled={acknowledge.isPending}
      >
        Entendi
      </Button>
    </div>
  )
}

function CartRow({ item }: { item: CartItem }) {
  const isDesktop = useIsDesktop()
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const busy = update.isPending || remove.isPending

  function changeQuantity(quantity: number) {
    update.mutate(
      { itemId: item.id, quantity },
      {
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : 'Não foi possível alterar a quantidade.'),
      },
    )
  }

  function removeItem() {
    remove.mutate(item.id, {
      onSuccess: () => toast.success(`${item.name} removido do carrinho.`),
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : 'Não foi possível remover o item.'),
    })
  }

  const status =
    item.status === 'sold_out'
      ? { text: 'Esgotado: remova o item para continuar.', tone: 'text-destructive' }
      : item.status === 'insufficient'
        ? { text: `Restam apenas ${item.maxQuantity}. Reduza a quantidade.`, tone: 'text-amber' }
        : item.status === 'price_changed' && item.previousUnitPrice
          ? {
              text: `Preço atualizado: era ${formatEth(item.previousUnitPrice)}.`,
              tone: 'text-amber',
            }
          : null

  const max = Math.max(item.quantity > item.maxQuantity ? item.quantity : item.maxQuantity, 1)

  return (
    <li
      className={cn(
        // Mobile (Figma "Cart Items"): cartão de 100 px com sombra; desktop: linha da tabela
        'relative flex min-h-[100px] overflow-hidden rounded-[14px] bg-card shadow-[0_6px_20px_rgb(10_6_4/0.45)] transition-opacity',
        'lg:grid lg:min-h-0 lg:grid-cols-[311px_139px_136px_minmax(0,1fr)_40px] lg:items-center lg:gap-0 lg:rounded-none lg:p-0 lg:shadow-none',
        busy && 'opacity-70',
      )}
      data-testid="cart-item"
      data-item-id={item.id}
      aria-busy={busy}
    >
      <div className="flex min-w-0 flex-1 gap-[9px] lg:items-center lg:gap-4">
        <div className="w-[100px] shrink-0 self-stretch lg:size-[70px] lg:self-auto">
          <NftImage
            image={item.image}
            alt=""
            sizes="100px"
            className="h-full rounded-[14px] lg:rounded-none"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col py-[13px] lg:gap-1 lg:py-0">
          <p className="text-[15px] leading-4 font-bold lg:text-base lg:leading-normal">
            {item.name}
            {/* Desktop: edição como selo ao lado do nome (o mesmo NFT pode estar em edições diferentes) */}
            <span className="ml-2 hidden rounded-full border border-border px-1.5 py-px align-middle text-[11px] font-normal text-muted-foreground lg:inline">
              {item.editionLabel}
            </span>
          </p>
          <p className="mt-1.5 text-sm leading-4 text-muted-foreground lg:mt-0 lg:leading-normal lg:text-brand-secondary">
            <span className="lg:hidden">Edição: {item.editionLabel}</span>
            <span className="hidden lg:inline">ID do token: {item.tokenNumber}</span>
          </p>
          <p className="mt-auto pt-4 text-lg leading-4 font-bold text-brand-accent lg:hidden">
            {formatEth(item.lineTotal)}
          </p>
          {status ? (
            <p
              className={cn('mt-1.5 text-xs lg:mt-0', status.tone)}
              role="status"
              data-testid="cart-item-status"
            >
              {status.text}
            </p>
          ) : null}
        </div>
      </div>
      <p
        className="hidden text-base font-bold text-muted-foreground lg:block"
        data-testid="cart-item-price"
      >
        {formatEth(item.unitPrice)}
      </p>
      <div className="flex shrink-0 items-center pr-4 pl-[7px] lg:p-0">
        <QuantityStepper
          value={item.quantity}
          max={max}
          onChange={changeQuantity}
          label={item.name}
          size="sm"
          variant={isDesktop ? 'solid' : 'outline'}
          maxHint={quantityLimitHint({ max, editionLabel: item.editionLabel })}
          disabled={busy || item.status === 'sold_out'}
        />
      </div>
      <p
        className="hidden text-base font-bold text-brand-accent lg:block"
        data-testid="cart-item-total"
      >
        {formatEth(item.lineTotal)}
      </p>
      <button
        type="button"
        onClick={removeItem}
        disabled={busy}
        className="absolute top-2 right-3 grid size-7 place-items-center rounded-sm text-primary hover:text-destructive lg:static lg:size-8 lg:text-brand-secondary"
        aria-label={`Remover ${item.name} do carrinho`}
      >
        <Trash2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </li>
  )
}

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-[86px]" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando carrinho…
      </p>
      <div className="flex flex-1 flex-col gap-5 lg:gap-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-[100px] rounded-[14px] lg:h-[70px] lg:rounded-none" />
        ))}
      </div>
      <div className="flex w-full flex-col gap-4 lg:w-[332px]" aria-hidden="true">
        <div className="shimmer h-10 rounded-sm" />
        <QuoteTotals loading quote={undefined} />
      </div>
    </div>
  )
}
