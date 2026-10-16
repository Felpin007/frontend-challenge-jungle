import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Heart, Loader2, Mail, ShoppingCart, Star, ZoomIn } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Edition, NftDetail } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { EthPrice } from '@/components/common/EthPrice'
import { QuantityStepper } from '@/components/common/QuantityStepper'
import { NotFoundPage } from '@/components/feedback/NotFoundPage'
import { ErrorState } from '@/components/feedback/States'
import { LinkedinIcon, TwitterIcon } from '@/components/icons/brand'
import { Container } from '@/components/layout/Container'
import { MobilePageHeader } from '@/components/layout/MobilePageHeader'
import { NftImage } from '@/components/nft/NftImage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAddToCart, useCart } from '@/features/cart/queries'
import { nftDetailQueryOptions } from '@/features/catalog/queries'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/queries'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { DetailSkeleton } from './DetailSkeleton'
import { RelatedNfts } from './RelatedNfts'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const query = useQuery(nftDetailQueryOptions(nftId))

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.code === 'NOT_FOUND') {
      return (
        <NotFoundPage
          title="NFT não encontrado"
          description="Este NFT não existe ou foi removido do mercado. Explore o catálogo para encontrar outras obras."
        />
      )
    }
    return (
      <Container className="py-16">
        <ErrorState
          error={query.error}
          title="Não foi possível carregar este NFT"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </Container>
    )
  }
  return <NftDetailView nft={query.data} />
}

function NftDetailView({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate()
  const { data: cart } = useCart()
  const addToCart = useAddToCart()
  const isFavorite = useIsFavorite(nft.id)
  const favorite = useToggleFavorite()
  const [editionId, setEditionId] = useState(nft.defaultEditionId ?? nft.editions[0]?.id)
  const [requestedQuantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)

  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]
  const inCart =
    cart?.items.find((i) => i.nftId === nft.id && i.editionId === edition?.id)?.quantity ?? 0
  const maxAddable = edition
    ? Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
    : 0
  const unavailable = !edition || edition.available === 0

  // Se a disponibilidade cair (ex.: evento em tempo real), a quantidade se ajusta ao novo limite.
  const quantity = Math.min(requestedQuantity, Math.max(1, maxAddable))

  function add({ goToCart }: { goToCart: boolean }) {
    if (!edition) return
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          toast.success(`${nft.name} (${edition.label}) × ${quantity} adicionado ao carrinho.`)
          setQuantity(1)
          if (goToCart) void navigate({ to: '/carrinho' })
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'Não foi possível adicionar ao carrinho.',
          ),
      },
    )
  }

  const limitMessage = unavailable
    ? 'Edição esgotada. Escolha outra edição.'
    : maxAddable === 0
      ? `Você já tem o máximo desta edição no carrinho (${inCart}).`
      : `Disponível: ${edition.available}${edition.supply ? ` de ${edition.supply}` : ''} · máximo de ${Math.min(edition.available, edition.maxPerOrder)} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`

  const favoriteButton = (
    <button
      type="button"
      onClick={() => favorite.toggle(nft.id, nft.name, isFavorite)}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
      className="grid size-9 place-items-center rounded-full bg-accent"
      data-testid="favorite-toggle-mobile"
    >
      <Heart
        className={cn('size-5', isFavorite ? 'fill-primary text-primary' : 'text-primary')}
        aria-hidden="true"
      />
    </button>
  )

  return (
    <article aria-labelledby="nft-title">
      <MobilePageHeader action={favoriteButton} titleAs="p" />
      <Container className="flex flex-col gap-16 lg:pt-8">
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
            <li aria-current="page" className="text-brand-accent">
              {nft.name}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-6 lg:-mt-12 lg:flex-row lg:gap-8">
          {/* Galeria */}
          <div className="flex flex-col-reverse gap-4 lg:flex-row lg:gap-7">
            <ul className="flex gap-3 lg:flex-col lg:gap-4" aria-label="Galeria">
              {nft.gallery.map((image, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Mostrar imagem ${index + 1} de ${nft.gallery.length}`}
                    aria-current={activeImage === index ? 'true' : undefined}
                    className={cn(
                      'block size-16 overflow-hidden rounded-sm border-2 lg:size-[100px]',
                      activeImage === index
                        ? 'border-primary'
                        : 'border-transparent opacity-80 hover:opacity-100',
                    )}
                  >
                    <NftImage image={image} alt="" sizes="100px" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative bg-card p-0 lg:size-[444px] lg:p-5">
              <NftImage
                image={nft.gallery[activeImage] ?? nft.image}
                sizes="(min-width: 1024px) 404px, 100vw"
                priority
                className="rounded-[24px]"
              />
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="absolute top-6 right-6 grid size-8 place-items-center rounded-full bg-background/80 lg:top-7 lg:right-7"
                aria-label="Ampliar imagem"
              >
                <ZoomIn className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Informações e compra */}
          <div className="flex flex-1 flex-col gap-4 rounded-t-[32px] bg-card p-6 lg:rounded-none lg:bg-transparent lg:p-0">
            <div className="flex items-start justify-between gap-4">
              <h1 id="nft-title" className="text-[28px] leading-9 font-bold">
                {nft.name}
              </h1>
              <p className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-sm lg:hidden">
                <Star className="size-3.5 fill-primary text-primary" aria-hidden="true" />
                {nft.rating.average.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} (
                {nft.rating.count})<span className="sr-only"> avaliações</span>
              </p>
            </div>
            <div className="hidden items-center justify-between gap-4 border-b border-border pb-3 lg:flex">
              <p className="text-[22px] font-bold text-brand-accent" data-testid="detail-price">
                {formatEth(edition?.price ?? nft.price)}
              </p>
              <p className="flex items-center gap-2 text-[15px]">
                <span className="flex" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'size-4',
                        i < Math.round(nft.rating.average)
                          ? 'fill-primary text-primary'
                          : 'text-primary',
                      )}
                    />
                  ))}
                </span>
                <span className="sr-only">
                  Nota {nft.rating.average.toLocaleString('pt-BR')} de 5,{' '}
                </span>
                {nft.rating.count} avaliações de colecionadores
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="hidden font-bold lg:block">Sobre este NFT:</h2>
              <p className="text-[15px] leading-6 text-muted-foreground lg:text-primary">
                {nft.description}
              </p>
            </div>

            <EditionPicker
              editions={nft.editions}
              value={edition?.id}
              onChange={(id) => {
                setEditionId(id)
                setQuantity(1)
              }}
            />

            <div className="hidden items-center justify-between gap-4 lg:flex">
              <QuantityStepper
                value={quantity}
                max={Math.max(1, maxAddable)}
                onChange={setQuantity}
                label={nft.name}
                disabled={unavailable || maxAddable === 0}
              />
              <div className="flex gap-3">
                <Button
                  className="h-10 w-[130px] font-bold"
                  onClick={() => add({ goToCart: true })}
                  disabled={unavailable || maxAddable === 0 || addToCart.isPending}
                  data-testid="buy-button"
                >
                  {addToCart.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  COMPRAR
                </Button>
                <Button
                  variant="outline"
                  className="h-10 w-[130px] text-[15px]"
                  onClick={() => favorite.toggle(nft.id, nft.name, isFavorite)}
                  aria-pressed={isFavorite}
                  data-testid="favorite-toggle"
                >
                  <Heart
                    className={cn('size-5', isFavorite && 'fill-primary text-primary')}
                    aria-hidden="true"
                  />
                  {isFavorite ? 'Favoritado' : 'Favoritar'}
                </Button>
              </div>
            </div>
            <p
              className={cn(
                'text-sm',
                unavailable || maxAddable === 0 ? 'text-amber' : 'text-muted-foreground',
              )}
              aria-live="polite"
              data-testid="availability"
            >
              {limitMessage}
            </p>

            <dl className="flex flex-col gap-3 text-[15px] text-muted-foreground lg:text-primary">
              <div className="flex gap-1">
                <dt>ID do token:</dt>
                <dd>{nft.tokenId}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Coleção:</dt>
                <dd>{nft.collection.name}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Atributos:</dt>
                <dd>{nft.attributes.join(', ')}</dd>
              </div>
            </dl>
            <ShareLinks name={nft.name} />
          </div>
        </div>

        <DetailTabs nft={nft} />
        <RelatedNfts nft={nft} />
      </Container>

      {/* Barra fixa de compra (mobile) */}
      <div className="fixed inset-x-0 bottom-[72px] z-30 flex flex-col gap-3 rounded-t-[28px] bg-card px-5 pt-4 pb-4 shadow-[0_-8px_24px_rgb(0_0_0/0.35)] lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm">Qtd.</span>
            <QuantityStepper
              value={quantity}
              max={Math.max(1, maxAddable)}
              onChange={setQuantity}
              label={nft.name}
              size="sm"
              disabled={unavailable || maxAddable === 0}
            />
          </div>
          <EthPrice value={edition?.price ?? nft.price} className="text-xl" />
        </div>
        <div className="flex gap-3">
          <Button
            className="h-14 flex-1 rounded-full bg-gradient-to-r from-primary to-[#b8743d] text-base font-bold"
            onClick={() => add({ goToCart: true })}
            disabled={unavailable || maxAddable === 0 || addToCart.isPending}
          >
            Comprar NFT
          </Button>
          <button
            type="button"
            className="grid size-14 place-items-center rounded-full bg-accent text-primary disabled:opacity-50"
            onClick={() => add({ goToCart: false })}
            disabled={unavailable || maxAddable === 0 || addToCart.isPending}
            aria-label="Adicionar ao carrinho"
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="h-36 lg:hidden" aria-hidden="true" />

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[min(90vw,900px)] border-0 bg-card p-4 sm:max-w-[min(90vw,900px)]">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
          <img
            src={(nft.gallery[activeImage] ?? nft.image).src.replace('-800.webp', '-1200.webp')}
            alt={(nft.gallery[activeImage] ?? nft.image).alt}
            className="h-auto w-full rounded-xl"
          />
        </DialogContent>
      </Dialog>
    </article>
  )
}

function EditionPicker({
  editions,
  value,
  onChange,
}: {
  editions: Edition[]
  value?: string
  onChange: (id: string) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-bold">Edição:</legend>
      <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-2">
        {editions.map((edition) => {
          const soldOut = edition.available === 0
          const selected = edition.id === value
          return (
            <button
              key={edition.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={soldOut}
              onClick={() => !soldOut && onChange(edition.id)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-sm transition',
                selected
                  ? 'border-primary font-bold text-brand-accent'
                  : 'border-border text-muted-foreground',
                soldOut ? 'cursor-not-allowed line-through opacity-50' : 'hover:border-primary',
              )}
              title={soldOut ? 'Edição esgotada' : `${formatEth(edition.price)}`}
            >
              {edition.label}
              {soldOut ? (
                <span className="sr-only"> (esgotada)</span>
              ) : (
                <span className="sr-only">, {formatEth(edition.price)}</span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ShareLinks({ name }: { name: string }) {
  const url = typeof window === 'undefined' ? '' : window.location.href
  const text = encodeURIComponent(`${name} na Kurio`)
  const encoded = encodeURIComponent(url)
  const linkClass = 'grid size-7 place-items-center rounded-sm hover:text-brand-accent'
  return (
    <div className="hidden items-center gap-3 lg:flex">
      <span className="font-bold">Compartilhar este NFT:</span>
      <a
        className={linkClass}
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no LinkedIn (abre em nova aba)"
      >
        <LinkedinIcon className="size-4" />
      </a>
      <a
        className={linkClass}
        href={`mailto:?subject=${text}&body=${encoded}`}
        aria-label="Compartilhar por e-mail"
      >
        <Mail className="size-4" aria-hidden="true" />
      </a>
      <a
        className={linkClass}
        href={`https://twitter.com/intent/tweet?text=${text}&url=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no Twitter (abre em nova aba)"
      >
        <TwitterIcon className="size-4" />
      </a>
    </div>
  )
}

function DetailTabs({ nft }: { nft: NftDetail }) {
  const [tab, setTab] = useState<'details' | 'reviews'>('details')
  const tabClass = (active: boolean) =>
    cn(
      'border-b-[3px] pb-1 text-lg',
      active
        ? 'border-primary font-bold text-brand-accent'
        : 'border-transparent hover:text-brand-accent',
    )
  return (
    <section className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Informações do NFT"
        className="flex gap-8 border-b border-primary/40"
      >
        <button
          type="button"
          role="tab"
          id="tab-details"
          aria-controls="panel-details"
          aria-selected={tab === 'details'}
          onClick={() => setTab('details')}
          className={tabClass(tab === 'details')}
        >
          Detalhes do NFT
        </button>
        <button
          type="button"
          role="tab"
          id="tab-reviews"
          aria-controls="panel-reviews"
          aria-selected={tab === 'reviews'}
          onClick={() => setTab('reviews')}
          className={tabClass(tab === 'reviews')}
        >
          Avaliações de colecionadores ({nft.rating.count})
        </button>
      </div>
      {tab === 'details' ? (
        <div
          role="tabpanel"
          id="panel-details"
          aria-labelledby="tab-details"
          className="flex flex-col gap-4 text-[15px] leading-6 text-primary"
        >
          {nft.longDescription.map((paragraph) => (
            <p key={paragraph.slice(0, 20)}>{paragraph}</p>
          ))}
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="font-bold text-foreground">Rede:</dt>
              <dd>
                Cunhado na{' '}
                {nft.network === 'ethereum'
                  ? 'Ethereum'
                  : nft.network === 'polygon'
                    ? 'Polygon'
                    : 'Solana'}{' '}
                com procedência imutável e metadados armazenados no IPFS.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Contrato:</dt>
              <dd>
                Direitos autorais do criador: {nft.royaltiesPercent}% nas vendas secundárias, pagos
                automaticamente pelos mercados compatíveis.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Direitos autorais:</dt>
              <dd>{nft.contract} • Contrato inteligente ERC-721 verificado.</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div
          role="tabpanel"
          id="panel-reviews"
          aria-labelledby="tab-reviews"
          className="text-[15px] text-muted-foreground"
        >
          <p>
            Nota média {nft.rating.average.toLocaleString('pt-BR')} de 5 em {nft.rating.count}{' '}
            avaliações. Os comentários individuais dos colecionadores ficam fora do escopo desta
            demonstração.
          </p>
        </div>
      )}
    </section>
  )
}
