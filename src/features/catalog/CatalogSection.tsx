import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { CATALOG_TABS, SORT_OPTIONS, type NftListResponse } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useIsDesktop } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { CatalogFilters } from './CatalogFilters'
import { nftListQueryOptions } from './queries'
import { CATALOG_PAGE_SIZE, SORT_LABELS, TAB_LABELS, toListQuery } from './search'
import { SpotlightCard } from './SpotlightCard'
import { useCatalogSearch } from './use-catalog-search'

export function CatalogSection() {
  const { search } = useCatalogSearch()
  const query = toListQuery(search)
  const list = useQuery(nftListQueryOptions(query))
  const facets = list.data?.facets
  const isDesktop = useIsDesktop()

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-6">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="flex gap-12">
        {/* Só no desktop: escondida por CSS, a barra ainda seria montada (o Slider mede o
            próprio tamanho e força layout). No mobile os filtros ficam no drawer. */}
        {isDesktop ? (
          <aside className="flex w-[310px] shrink-0 flex-col gap-6" aria-label="Filtros">
            <CatalogFilters facets={facets} />
            <SpotlightCard />
          </aside>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <CatalogToolbar />
          <ActiveSearchChip />
          <CatalogResults list={list} />
        </div>
      </div>
    </section>
  )
}

function CatalogToolbar() {
  const { search, update } = useCatalogSearch()
  const activeTab = search.tab ?? 'all'
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div role="tablist" aria-label="Seções do catálogo" className="flex gap-5 overflow-x-auto">
        {CATALOG_TABS.map((tab) => {
          const selected = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="catalog-results"
              onClick={() => update({ tab: tab === 'all' ? undefined : tab })}
              className={cn(
                'shrink-0 border-b-2 pb-1 text-[15px] font-medium whitespace-nowrap',
                selected
                  ? 'border-primary text-brand-accent'
                  : 'border-transparent hover:text-brand-accent',
              )}
            >
              {TAB_LABELS[tab]}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <span id="sort-label" className="text-[15px] whitespace-nowrap">
          Ordenar por:
        </span>
        <Select
          value={search.sort ?? 'recent'}
          onValueChange={(value) =>
            update({ sort: value === 'recent' ? undefined : (value as typeof search.sort) })
          }
        >
          <SelectTrigger
            aria-labelledby="sort-label"
            className="h-auto border-0 bg-transparent px-1 py-0 text-[15px] shadow-none dark:bg-transparent"
            data-testid="sort-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {SORT_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function ActiveSearchChip() {
  const { search, update } = useCatalogSearch()
  if (!search.q) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Resultados para</span>
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1">
        “{search.q}”
        <button
          type="button"
          onClick={() => update({ q: undefined })}
          aria-label={`Remover busca por ${search.q}`}
          className="rounded-full"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

function CatalogResults({ list }: { list: ReturnType<typeof useQuery<NftListResponse>> }) {
  const { search, update, clearFilters } = useCatalogSearch()
  const resultsRef = useRef<HTMLDivElement>(null)
  const page = search.page ?? 1

  // Ao trocar de página, leva o foco/rolagem para o início dos resultados.
  const previousPage = useRef(page)
  useEffect(() => {
    if (previousPage.current !== page) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      previousPage.current = page
    }
  }, [page])

  const data = list.data
  const isUpdating = list.isFetching && list.isPlaceholderData

  let content: React.ReactNode
  if (list.isPending) {
    content = (
      <Grid>
        {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
          <NftCardSkeleton key={i} />
        ))}
      </Grid>
    )
  } else if (list.isError && !data) {
    content = (
      <ErrorState
        error={list.error}
        title="Não foi possível carregar o catálogo"
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (data && data.items.length === 0) {
    content = (
      <EmptyState
        title="Nenhum NFT encontrado"
        description="Tente outros termos de busca ou remova alguns filtros."
        action={
          <Button variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>
        }
      />
    )
  } else if (data) {
    content = (
      <>
        <Grid aria-busy={isUpdating}>
          {data.items.map((nft, index) => (
            <NftCard key={nft.id} nft={nft} priority={index < 3} />
          ))}
        </Grid>
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onChange={(next) => update({ page: next > 1 ? next : undefined })}
        />
      </>
    )
  }

  return (
    <div
      ref={resultsRef}
      id="catalog-results"
      role="tabpanel"
      className={cn(
        'flex scroll-mt-6 flex-col gap-12 transition-opacity',
        isUpdating && 'opacity-60',
      )}
      data-testid="catalog-results"
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {list.isPending
          ? 'Carregando NFTs'
          : data
            ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}, página ${data.page} de ${data.totalPages}`
            : ''}
      </p>
      {list.isError && data ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível atualizar a lista. Exibindo os últimos resultados.{' '}
          <button type="button" className="underline" onClick={() => void list.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : null}
      {content}
    </div>
  )
}

function Grid({ children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:gap-x-8 lg:gap-y-[72px]"
      {...props}
    >
      {children}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const box =
    'grid size-[35px] place-items-center rounded-sm border border-border text-lg disabled:opacity-40'
  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <li>
            <button
              type="button"
              className={box}
              onClick={() => onChange(page - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-[18px]" aria-hidden="true" />
            </button>
          </li>
        ) : null}
        {pages.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              className={cn(
                box,
                p === page
                  ? 'border-primary bg-primary font-bold text-primary-foreground'
                  : 'hover:border-primary',
              )}
            >
              {p}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={box}
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-[18px]" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  )
}

/** Mobile/tablet: busca ("Explorar coleções") e botão que abre os filtros num drawer. */
export function MobileSearchBar() {
  const { search, update, activeFilterCount } = useCatalogSearch()
  const { data } = useQuery(nftListQueryOptions(toListQuery(search)))
  const facets = data?.facets
  const [term, setTerm] = useState(search.q ?? '')
  // A busca mudou por fora (voltar/avançar, limpar filtros): atualiza o campo.
  const [previousQ, setPreviousQ] = useState(search.q)
  if (search.q !== previousQ) {
    setPreviousQ(search.q)
    setTerm(search.q ?? '')
  }

  // Debounce: atualiza a URL 350 ms depois da última tecla (replace para não poluir o histórico).
  const commit = useEffectEvent((value: string) => {
    if (value !== (search.q ?? '')) update({ q: value || undefined }, { replace: true })
  })
  useEffect(() => {
    const timer = setTimeout(() => commit(term.trim()), 350)
    return () => clearTimeout(timer)
  }, [term])

  return (
    <div className="flex gap-3 lg:hidden">
      <form role="search" className="relative flex-1" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="mobile-search" className="sr-only">
          Explorar coleções
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brand-secondary"
          aria-hidden="true"
        />
        <input
          id="mobile-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Explorar coleções"
          className="h-11 w-full rounded-xl bg-card pr-4 pl-12 text-[15px] placeholder:text-brand-secondary"
        />
      </form>
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="relative grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"
            aria-label={activeFilterCount ? `Filtros (${activeFilterCount} ativos)` : 'Filtros'}
          >
            <SlidersHorizontal className="size-5" aria-hidden="true" />
            {activeFilterCount ? (
              <span
                className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background"
                aria-hidden="true"
              >
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-0 bg-card p-0"
        >
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Os resultados são atualizados a cada alteração.</SheetDescription>
          </SheetHeader>
          <CatalogFilters facets={facets} className="pb-10" />
        </SheetContent>
      </Sheet>
    </div>
  )
}
