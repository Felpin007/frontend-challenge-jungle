import { useQuery } from '@tanstack/react-query'
import type { NftDetail } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { nftListQueryOptions } from '@/features/catalog/queries'

/** "Mais desta coleção" / "Colecionadores também viram": lista horizontal com rolagem. */
export function RelatedNfts({
  nft,
  title = 'Mais desta coleção',
}: {
  nft?: NftDetail
  title?: string
}) {
  const { data } = useQuery(
    nftListQueryOptions({ page: 1, pageSize: 8, sort: 'popular', tab: 'all' }),
  )
  const items = (data?.items ?? []).filter((item) => item.id !== nft?.id).slice(0, 5)
  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <h2
        id="related-title"
        className="border-b border-primary/40 pb-3 text-lg font-bold text-brand-accent"
      >
        {title}
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
        {data
          ? items.map((item) => (
              <li key={item.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-auto">
                <NftCard nft={item} />
              </li>
            ))
          : Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[46%] shrink-0 sm:w-[30%] lg:w-auto">
                <NftCardSkeleton />
              </li>
            ))}
      </ul>
    </section>
  )
}
