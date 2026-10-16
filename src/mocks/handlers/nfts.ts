import { http, HttpResponse } from 'msw'
import {
  CatalogTab,
  Category,
  EthAmount,
  Network,
  NftSort,
  type FavoritesResponse,
  type NftListQuery,
} from '@/api/contracts'
import { db, persist } from '../db'
import { featured, findNft, listNfts, toSummary } from '../domain/catalog'
import { apiError, authenticate, simulate } from '../mock-http'

function parseList<T extends string>(
  value: string | null,
  schema: { safeParse: (v: unknown) => { success: boolean } },
) {
  if (!value) return undefined
  return value.split(',').filter((v) => schema.safeParse(v).success) as T[]
}

function parseQuery(url: URL): NftListQuery {
  const p = url.searchParams
  const valid = <T>(
    schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
    v: string | null,
  ) => {
    if (v === null) return undefined
    const r = schema.safeParse(v)
    return r.success ? r.data : undefined
  }
  return {
    q: p.get('q') ?? undefined,
    categories: parseList<Category>(p.get('categories'), Category),
    networks: parseList<Network>(p.get('networks'), Network),
    minPrice: valid(EthAmount, p.get('minPrice')),
    maxPrice: valid(EthAmount, p.get('maxPrice')),
    tab: valid(CatalogTab, p.get('tab')),
    sort: valid(NftSort, p.get('sort')),
    page: Math.max(1, Number(p.get('page')) || 1),
    pageSize: Math.min(48, Math.max(1, Number(p.get('pageSize')) || 9)),
  }
}

export const nftHandlers = [
  http.get('/api/nfts', async ({ request }) => {
    const failure = await simulate('nfts', request)
    if (failure) return failure
    return HttpResponse.json(listNfts(parseQuery(new URL(request.url))))
  }),

  http.get('/api/nfts/featured', async ({ request }) => {
    const failure = await simulate('nfts', request)
    if (failure) return failure
    const data = featured()
    if (!data) return apiError(404, 'NOT_FOUND', 'Nenhum destaque disponível.')
    return HttpResponse.json(data)
  }),

  http.get('/api/nfts/:id', async ({ request, params }) => {
    const failure = await simulate('nfts', request)
    if (failure) return failure
    const nft = findNft(String(params.id))
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json(nft)
  }),

  http.get('/api/favorites', async ({ request }) => {
    const failure = await simulate('favorites', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    return HttpResponse.json<FavoritesResponse>({ nftIds: db().favorites[auth.user.id] ?? [] })
  }),

  http.get('/api/favorites/items', async ({ request }) => {
    const failure = await simulate('favorites', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const ids = db().favorites[auth.user.id] ?? []
    const items = ids
      .map((id) => findNft(id))
      .filter((n) => n !== undefined)
      .map(toSummary)
    return HttpResponse.json({ items })
  }),

  http.put('/api/favorites/:nftId', async ({ request, params }) => {
    const failure = await simulate('favorites', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const nftId = String(params.nftId)
    if (!findNft(nftId)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const list = (db().favorites[auth.user.id] ??= [])
    if (!list.includes(nftId)) list.push(nftId)
    persist()
    return HttpResponse.json<FavoritesResponse>({ nftIds: list })
  }),

  http.delete('/api/favorites/:nftId', async ({ request, params }) => {
    const failure = await simulate('favorites', request)
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const nftId = String(params.nftId)
    db().favorites[auth.user.id] = (db().favorites[auth.user.id] ?? []).filter((id) => id !== nftId)
    persist()
    return HttpResponse.json<FavoritesResponse>({ nftIds: db().favorites[auth.user.id] })
  }),
]
