import { Link } from '@tanstack/react-router'
import { Heart, Loader2, Search, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import type { NftSummary } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { EthPrice } from '@/components/common/EthPrice'
import { useAddToCart } from '@/features/cart/queries'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/queries'
import { cn } from '@/lib/utils'
import { NftImage } from './NftImage'

const actionClass =
  'grid size-9 place-items-center rounded-sm border border-primary/40 bg-background/90 text-foreground transition hover:text-primary focus-visible:opacity-100 disabled:opacity-60'

export function NftCard({ nft, priority = false }: { nft: NftSummary; priority?: boolean }) {
  const isFavorite = useIsFavorite(nft.id)
  const favorite = useToggleFavorite()
  const addToCart = useAddToCart()
  const soldOut = nft.totalAvailable === 0 || !nft.defaultEditionId

  function quickAdd() {
    if (!nft.defaultEditionId) return
    addToCart.mutate(
      { nftId: nft.id, editionId: nft.defaultEditionId, quantity: 1 },
      {
        onSuccess: () => toast.success(`${nft.name} adicionado ao carrinho.`),
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'Não foi possível adicionar ao carrinho.',
          ),
      },
    )
  }

  return (
    <article
      className="group relative flex flex-col gap-3"
      data-testid="nft-card"
      data-nft-id={nft.id}
    >
      <div className="relative overflow-hidden rounded-2xl bg-card p-1 lg:rounded-none lg:px-1 lg:pt-6 lg:pb-[26px]">
        <NftImage
          image={nft.image}
          priority={priority}
          sizes="(min-width: 1024px) 250px, (min-width: 640px) 33vw, 50vw"
          className="rounded-[15px]"
        />
        {nft.badge ? (
          <span className="absolute top-0 left-0 bg-primary px-3 py-1 text-sm font-medium text-primary-foreground lg:top-4">
            {nft.badge}
          </span>
        ) : null}
        {soldOut ? (
          <span className="absolute bottom-3 left-3 rounded-sm bg-background/90 px-2 py-1 text-xs font-bold lg:top-6 lg:right-2 lg:bottom-auto lg:left-auto">
            Esgotado
          </span>
        ) : null}
        {/* Mobile: só o favorito, no canto da imagem (Figma "Mobile / Início") */}
        <FavoriteButton
          nft={nft}
          isFavorite={isFavorite}
          onToggle={() => favorite.toggle(nft.id, nft.name, isFavorite)}
          className="absolute top-3 right-3 z-10 size-8 rounded-full lg:hidden"
        />
        {/* Desktop: ações rápidas no hover ou quando algo do card recebe foco */}
        <div className="absolute inset-x-0 bottom-8 z-10 hidden justify-center gap-2 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 lg:flex">
          <button
            type="button"
            className={actionClass}
            onClick={quickAdd}
            disabled={soldOut || addToCart.isPending}
            aria-label={soldOut ? `${nft.name} esgotado` : `Adicionar ${nft.name} ao carrinho`}
          >
            {addToCart.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShoppingCart className="size-4" aria-hidden="true" />
            )}
          </button>
          <FavoriteButton
            nft={nft}
            isFavorite={isFavorite}
            onToggle={() => favorite.toggle(nft.id, nft.name, isFavorite)}
          />
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className={actionClass}
            aria-label={`Ver detalhes de ${nft.name}`}
            tabIndex={-1}
          >
            <Search className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-2 lg:gap-3 lg:px-0">
        <h3 className="text-[15px] leading-4 lg:text-base">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="after:absolute after:inset-0 after:content-[''] hover:text-brand-accent"
          >
            {nft.name}
          </Link>
        </h3>
        <EthPrice
          value={nft.price}
          compareAt={nft.compareAtPrice}
          className="text-[17px] leading-4 lg:text-lg"
        />
      </div>
    </article>
  )
}

function FavoriteButton({
  nft,
  isFavorite,
  onToggle,
  className,
}: {
  nft: NftSummary
  isFavorite: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(actionClass, className)}
      onClick={onToggle}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
    >
      <Heart
        className={cn('size-4', isFavorite && 'fill-primary text-primary')}
        aria-hidden="true"
      />
    </button>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true" data-testid="nft-card-skeleton">
      <div className="rounded-2xl bg-card p-1 lg:rounded-none lg:px-1 lg:pt-6 lg:pb-[26px]">
        <div className="shimmer aspect-square w-full rounded-[15px]" />
      </div>
      <div className="flex flex-col gap-2 px-2 lg:gap-3 lg:px-0">
        <div className="shimmer h-4 w-3/4 rounded-sm" />
        <div className="shimmer h-4 w-1/3 rounded-sm" />
      </div>
    </div>
  )
}
