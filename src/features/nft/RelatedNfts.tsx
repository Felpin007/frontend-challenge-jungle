import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { NftDetail } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { nftListQueryOptions } from '@/features/catalog/queries'
import { cn } from '@/lib/utils'

/**
 * "Mais desta coleção" / "Colecionadores também viram" (Figma): carrossel de 5
 * cartões por página com pontos de paginação. Itens da mesma categoria primeiro,
 * completados pelos mais populares (sem algoritmo de recomendação; ver ARCHITECTURE.md).
 */
export function RelatedNfts({
  nft,
  title = 'Mais desta coleção',
}: {
  nft?: NftDetail
  title?: string
}) {
  const { data } = useQuery(
    nftListQueryOptions({ page: 1, pageSize: 24, sort: 'popular', tab: 'all' }),
  )
  const category = nft?.category ?? 'arte-digital'
  const items = (data?.items ?? [])
    .filter((item) => item.id !== nft?.id)
    .sort((a, b) => Number(b.category === category) - Number(a.category === category))
    .slice(0, 15)

  const listRef = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  // Páginas = quantas "telas" de largura a lista tem (5 cartões no desktop, menos no mobile).
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      setPages(Math.max(1, Math.round(list.scrollWidth / list.clientWidth)))
      setPage(Math.round(list.scrollLeft / list.clientWidth))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    list.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      list.removeEventListener('scroll', measure)
    }
  }, [items.length])

  function goTo(index: number) {
    const list = listRef.current
    if (!list) return
    list.scrollTo({ left: index * list.clientWidth, behavior: 'smooth' })
  }

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <h2
        id="related-title"
        className="border-b border-primary/30 pb-3 text-[17px] leading-4 font-bold text-brand-accent"
      >
        {title}
      </h2>
      <ul
        ref={listRef}
        className="-mx-6 flex snap-x snap-mandatory [scrollbar-width:none] gap-6 overflow-x-auto px-6 pb-2 lg:mx-0 lg:gap-7 lg:px-0 lg:pb-0"
      >
        {data
          ? items.map((item) => (
              <li
                key={item.id}
                className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-4*28px)/5)]"
              >
                <NftCard nft={item} size="compact" />
              </li>
            ))
          : Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[46%] shrink-0 sm:w-[30%] lg:w-[calc((100%-4*28px)/5)]">
                <NftCardSkeleton />
              </li>
            ))}
      </ul>
      {pages > 1 ? (
        <div
          className="-mt-2 flex justify-center gap-2"
          role="group"
          aria-label={`Páginas de ${title}`}
        >
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Página ${i + 1} de ${pages}`}
              aria-current={i === page ? 'true' : undefined}
              className="grid size-6 place-items-center rounded-full"
            >
              <span
                className={cn(
                  'block size-3 rounded-full border-[1.3px] border-primary transition-colors',
                  i === page && 'bg-primary',
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
