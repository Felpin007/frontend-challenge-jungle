import { z } from 'zod'
import {
  CatalogTab,
  Category,
  EthAmount,
  Network,
  NftSort,
  type NftListQuery,
} from '@/api/contracts'

export const CATALOG_PAGE_SIZE = 9

/** Lista separada por vírgula na URL ("musica,fotografia"), mais legível que JSON. */
const csvOf = <T extends z.ZodType<string>>(item: T) =>
  z
    .string()
    .transform((value) =>
      value
        .split(',')
        .filter((v) => item.safeParse(v).success)
        .join(','),
    )
    .transform((value) => value || undefined)
    .optional()
    .catch(undefined)

/**
 * Estado do catálogo na URL. Valores inválidos são descartados (`.catch`),
 * então um link editado à mão nunca quebra a página.
 * Valores padrão (aba "all", ordenação "recent", página 1) ficam fora da URL.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  categories: csvOf(Category),
  networks: csvOf(Network),
  minPrice: EthAmount.optional().catch(undefined),
  maxPrice: EthAmount.optional().catch(undefined),
  tab: CatalogTab.exclude(['all']).optional().catch(undefined),
  sort: NftSort.exclude(['recent']).optional().catch(undefined),
  page: z.coerce.number().int().min(2).optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export function toListQuery(search: CatalogSearch): NftListQuery {
  return {
    q: search.q || undefined,
    categories: search.categories ? (search.categories.split(',') as Category[]) : undefined,
    networks: search.networks ? (search.networks.split(',') as Network[]) : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab ?? 'all',
    sort: search.sort ?? 'recent',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

export const SORT_LABELS: Record<z.infer<typeof NftSort>, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais populares',
  name: 'Nome (A–Z)',
}

export const TAB_LABELS: Record<z.infer<typeof CatalogTab>, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}
