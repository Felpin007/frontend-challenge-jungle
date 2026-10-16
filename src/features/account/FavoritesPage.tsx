import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { favoritesApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { Button } from '@/components/ui/button'
import { useStoredSession } from '@/features/auth/session-store'
import { useFavorites } from '@/features/favorites/queries'

/** Lista de interesse: NFTs favoritados pelo usuário autenticado. */
export function FavoritesPage() {
  const session = useStoredSession()
  const userId = session!.userId
  const ids = useFavorites()
  const items = useQuery({
    queryKey: queryKeys.user.favoriteItems(userId),
    queryFn: ({ signal }) => favoritesApi.items({ signal }),
  })

  // Ao desfavoritar aqui, o card some na hora (o cache de ids é otimista).
  const visible =
    items.data?.items.filter((nft) => !ids.data || ids.data.nftIds.includes(nft.id)) ?? []

  return (
    <section aria-labelledby="favorites-title" className="flex flex-col gap-6">
      <h1 id="favorites-title" className="text-lg font-bold">
        Lista de interesse
      </h1>
      {items.isPending ? (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : items.isError ? (
        <ErrorState error={items.error} onRetry={() => void items.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-8 text-muted-foreground" aria-hidden="true" />}
          title="Nenhum favorito ainda"
          description="Toque no coração de um NFT para salvá-lo aqui."
          action={
            <Button asChild>
              <Link to="/" hash="catalogo">
                Explorar NFTs
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3" aria-label="Favoritos">
          {visible.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
