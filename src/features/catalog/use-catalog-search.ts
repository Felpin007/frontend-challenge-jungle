import { getRouteApi } from '@tanstack/react-router'
import type { CatalogSearch } from './search'

const route = getRouteApi('/')

/**
 * Lê e altera o estado do catálogo na URL. Toda mudança de filtro, busca,
 * aba ou ordenação reinicia a paginação (page volta para 1, omitida da URL).
 */
export function useCatalogSearch() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  function update(patch: Partial<CatalogSearch>, { replace = false } = {}) {
    void navigate({
      search: (prev) => ({ ...prev, ...patch, page: 'page' in patch ? patch.page : undefined }),
      replace,
      resetScroll: false,
    })
  }

  function toggleInList(key: 'categories' | 'networks', value: string) {
    const current = search[key]?.split(',') ?? []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    update({ [key]: next.length ? next.join(',') : undefined })
  }

  function clearFilters() {
    update({
      categories: undefined,
      networks: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      q: undefined,
    })
  }

  const activeFilterCount =
    (search.categories?.split(',').length ?? 0) +
    (search.networks?.split(',').length ?? 0) +
    (search.minPrice || search.maxPrice ? 1 : 0)

  return { search, update, toggleInList, clearFilters, activeFilterCount }
}
