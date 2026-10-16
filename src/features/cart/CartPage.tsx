import { Link, useNavigate } from '@tanstack/react-router'
import { ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Cart, CartItem } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { QuantityStepper } from '@/components/common/QuantityStepper'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { Container } from '@/components/layout/Container'
import { MobilePageHeader } from '@/components/layout/MobilePageHeader'
import { NftImage } from '@/components/nft/NftImage'
import { Button } from '@/components/ui/button'
import { RelatedNfts } from '@/features/nft/RelatedNfts'
import { formatEth } from '@/lib/money'
import { useIsDesktop } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { CouponForm, QuoteTotals } from './CartSummary'
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
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-[86px]">
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
          <ul className="flex flex-col gap-3" aria-label="Itens do carrinho">
            {data.items.map((item) => (
              <CartRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
        <aside
          aria-labelledby="summary-title"
          className="flex w-full flex-col gap-5 rounded-t-[28px] bg-card p-5 lg:w-[332px] lg:rounded-none lg:bg-transparent lg:p-0"
        >
          <h2
            id="summary-title"
            className="hidden border-b border-border pb-3 text-lg font-bold lg:block"
          >
            Resumo da carteira
          </h2>
          <CouponForm cart={data} variant={isDesktop ? 'desktop' : 'mobile'} />
          <QuoteTotals quote={quote.data} loading={quote.isPending} updating={quoteUpdating} />
          {quote.isError ? (
            <ErrorState
              error={quote.error}
              title="Não foi possível calcular os valores"
              onRetry={() => void quote.refetch()}
              className="py-4"
            />
          ) : null}
          {blocking ? (
            <p role="alert" className="text-sm text-amber">
              Ajuste os itens esgotados ou com estoque insuficiente para continuar.
            </p>
          ) : null}
          <Button
            className="h-14 rounded-full text-base font-bold max-lg:bg-linear-to-r max-lg:from-primary max-lg:to-[#b8743d] lg:h-10 lg:rounded-[3px]"
            disabled={blocking || !quote.data || quoteUpdating}
            onClick={() => void navigate({ to: '/pagamento' })}
            data-testid="checkout-button"
          >
            Conectar e finalizar
          </Button>
          <Link
            to="/"
            hash="catalogo"
            className="text-center text-[15px] text-brand-accent hover:underline"
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
      <Container className="flex flex-col gap-16 lg:pt-8">
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

  return (
    <li
      className={cn(
        'relative flex gap-3 overflow-hidden rounded-2xl bg-card transition-opacity lg:grid lg:grid-cols-[311px_139px_136px_minmax(0,1fr)_40px] lg:items-center lg:gap-0 lg:rounded-none lg:p-0',
        busy && 'opacity-70',
      )}
      data-testid="cart-item"
      data-item-id={item.id}
      aria-busy={busy}
    >
      <div className="flex items-center gap-4 lg:gap-4">
        <div className="w-[100px] shrink-0 self-stretch lg:size-[70px]">
          <NftImage
            image={item.image}
            alt=""
            sizes="100px"
            className="h-full rounded-l-2xl lg:rounded-none"
          />
        </div>
        <div className="flex flex-col gap-1 py-3 lg:py-0">
          <p className="font-bold">
            {item.name}
            {/* Desktop: edição como selo ao lado do nome (o mesmo NFT pode estar em edições diferentes) */}
            <span className="ml-2 hidden rounded-full border border-border px-1.5 py-px align-middle text-[11px] font-normal text-muted-foreground lg:inline">
              {item.editionLabel}
            </span>
          </p>
          <p className="text-sm text-brand-secondary">
            <span className="lg:hidden">Edição: {item.editionLabel}</span>
            <span className="hidden lg:inline">ID do token: {item.tokenNumber}</span>
          </p>
          <p className="text-lg font-bold text-brand-accent lg:hidden">
            {formatEth(item.lineTotal)}
          </p>
          {status ? (
            <p className={cn('text-xs', status.tone)} role="status" data-testid="cart-item-status">
              {status.text}
            </p>
          ) : null}
        </div>
      </div>
      <p className="hidden text-base font-bold text-muted-foreground lg:block" data-testid="cart-item-price">
        {formatEth(item.unitPrice)}
      </p>
      <div className="ml-auto flex flex-col items-end justify-center gap-2 pr-3 lg:ml-0 lg:items-start lg:pr-0">
        <QuantityStepper
          value={item.quantity}
          max={Math.max(item.quantity > item.maxQuantity ? item.quantity : item.maxQuantity, 1)}
          onChange={changeQuantity}
          label={item.name}
          size="sm"
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
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-sm text-brand-secondary hover:text-destructive lg:static"
        aria-label={`Remover ${item.name} do carrinho`}
      >
        <Trash2 className="size-5" aria-hidden="true" />
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
      <div className="flex flex-1 flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-[100px] rounded-2xl lg:h-[70px] lg:rounded-none" />
        ))}
      </div>
      <div className="flex w-full flex-col gap-4 lg:w-[332px]" aria-hidden="true">
        <div className="shimmer h-10 rounded-sm" />
        <QuoteTotals loading quote={undefined} />
      </div>
    </div>
  )
}
