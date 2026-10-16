import { useId, useState, type FormEvent } from 'react'
import type { NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { isEthString } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useCatalogSearch } from './use-catalog-search'

type Facets = NftListResponse['facets']

/**
 * Filtros combináveis do catálogo (coleções, faixa de preço e rede).
 * Usado na barra lateral (desktop) e no drawer de filtros (mobile/tablet).
 */
export function CatalogFilters({ facets, className }: { facets?: Facets; className?: string }) {
  const { search, toggleInList, clearFilters, activeFilterCount } = useCatalogSearch()
  const selectedCategories = search.categories?.split(',') ?? []
  const selectedNetworks = search.networks?.split(',') ?? []

  return (
    <div className={cn('flex flex-col gap-6 bg-card p-5', className)}>
      <FilterGroup title="Coleções">
        {facets ? (
          facets.categories.map((facet) => (
            <FacetCheckbox
              key={facet.id}
              label={facet.label}
              count={facet.count}
              checked={selectedCategories.includes(facet.id)}
              onToggle={() => toggleInList('categories', facet.id)}
            />
          ))
        ) : (
          <FacetSkeleton rows={9} />
        )}
      </FilterGroup>

      {/* key: quando a URL muda (voltar/avançar, limpar), o filtro recomeça com os valores dela */}
      <PriceFilter key={`${search.minPrice}-${search.maxPrice}`} range={facets?.priceRange} />

      <FilterGroup title="Rede">
        {facets ? (
          facets.networks.map((facet) => (
            <FacetCheckbox
              key={facet.id}
              label={facet.label}
              count={facet.count}
              checked={selectedNetworks.includes(facet.id)}
              onToggle={() => toggleInList('networks', facet.id)}
            />
          ))
        ) : (
          <FacetSkeleton rows={3} />
        )}
      </FilterGroup>

      {activeFilterCount > 0 || search.q ? (
        <Button variant="outline" onClick={clearFilters}>
          Limpar filtros
        </Button>
      ) : null}
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <fieldset className="flex flex-col gap-1" aria-labelledby={id}>
      <legend id={id} className="mb-2 text-lg font-bold">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function FacetCheckbox({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string
  count: number
  checked: boolean
  onToggle: () => void
}) {
  const id = useId()
  // Checkbox nativo: o Checkbox do Radix mede o próprio tamanho num layout effect,
  // forçando um recálculo de layout da página para cada filtro (custo alto no mobile).
  return (
    <div className="flex min-h-10 items-center gap-3 px-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 shrink-0 cursor-pointer accent-primary"
      />
      <Label
        htmlFor={id}
        className={cn(
          'flex flex-1 cursor-pointer justify-between text-[15px] font-normal',
          checked ? 'text-brand-accent' : 'text-muted-foreground',
        )}
      >
        <span>{label}</span>
        <span>({count})</span>
      </Label>
    </div>
  )
}

function FacetSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3 px-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="shimmer h-7 rounded-sm" />
      ))}
    </div>
  )
}

function PriceFilter({ range }: { range?: Facets['priceRange'] }) {
  const { search, update } = useCatalogSearch()
  const min = range ? Number(range.min) : 0
  const max = range ? Math.ceil(Number(range.max)) : 13
  const [values, setValues] = useState({ min: search.minPrice ?? '', max: search.maxPrice ?? '' })
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  function apply(event: FormEvent) {
    event.preventDefault()
    const minValue = values.min.replace(',', '.').trim()
    const maxValue = values.max.replace(',', '.').trim()
    if ((minValue && !isEthString(minValue)) || (maxValue && !isEthString(maxValue))) {
      setError('Use valores numéricos, ex.: 0.5')
      return
    }
    if (minValue && maxValue && Number(minValue) > Number(maxValue)) {
      setError('O mínimo não pode ser maior que o máximo')
      return
    }
    setError(null)
    update({ minPrice: minValue || undefined, maxPrice: maxValue || undefined })
  }

  const sliderValue = [values.min ? Number(values.min) : min, values.max ? Number(values.max) : max]

  return (
    <form
      onSubmit={apply}
      className="flex flex-col gap-3"
      aria-labelledby="price-filter-title"
      noValidate
    >
      <h3 id="price-filter-title" className="text-lg font-bold">
        Faixa de preço
      </h3>
      <Slider
        className="px-3"
        min={min}
        max={max}
        step={0.01}
        value={sliderValue}
        onValueChange={([lo, hi]) => setValues({ min: lo.toFixed(2), max: hi.toFixed(2) })}
        aria-label="Faixa de preço em ETH"
        thumbLabels={['Preço mínimo', 'Preço máximo']}
      />
      <div className="grid grid-cols-2 gap-2 px-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="price-min" className="text-xs text-muted-foreground">
            Mínimo (ETH)
          </Label>
          <Input
            id="price-min"
            inputMode="decimal"
            value={values.min}
            placeholder={range?.min ?? '0'}
            onChange={(e) => setValues((v) => ({ ...v, min: e.target.value }))}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="price-max" className="text-xs text-muted-foreground">
            Máximo (ETH)
          </Label>
          <Input
            id="price-max"
            inputMode="decimal"
            value={values.max}
            placeholder={range?.max ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, max: e.target.value }))}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
      </div>
      {error ? (
        <p id={errorId} className="px-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="px-3">
        <Button type="submit" size="sm" className="font-bold">
          Aplicar
        </Button>
      </div>
    </form>
  )
}
