import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { NftListQuery } from '@/api/contracts'
import { nftApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'

/**
 * Lista do catálogo. A chave contém todos os parâmetros, então cada combinação
 * de filtros tem seu próprio cache e uma resposta antiga nunca sobrescreve a
 * atual (respostas fora de ordem são descartadas naturalmente). O `signal`
 * cancela a requisição quando os parâmetros mudam antes da resposta chegar.
 */
export const nftListQueryOptions = (query: NftListQuery) =>
  queryOptions({
    queryKey: queryKeys.nfts.list(query),
    queryFn: ({ signal }) => nftApi.list(query, { signal }),
    placeholderData: keepPreviousData,
  })

export const featuredQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.nfts.featured,
    queryFn: ({ signal }) => nftApi.featured({ signal }),
    staleTime: 60_000,
  })

export const nftDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: ({ signal }) => nftApi.detail(id, { signal }),
  })
