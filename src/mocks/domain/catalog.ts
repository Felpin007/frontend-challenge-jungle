import {
  CATEGORIES,
  NETWORKS,
  type Edition,
  type FeaturedResponse,
  type NftDetail,
  type NftListQuery,
  type NftListResponse,
  type NftSummary,
} from '@/api/contracts'
import { compareEth, toWei } from '@/lib/money'
import { db, persist } from '../db'
import { getScenario } from '../scenarios'
import { CATEGORY_LABELS, lowestAvailablePrice, NETWORK_LABELS, SEED_REFERENCE_DATE } from '../seed'
import { publish } from './bus'

export const DEFAULT_PAGE_SIZE = 9

export function toSummary(nft: NftDetail): NftSummary {
  const {
    description: _d,
    longDescription: _l,
    attributes: _a,
    gallery: _g,
    editions: _e,
    tokenId: _t,
    contract: _c,
    royaltiesPercent: _r,
    rating: _rt,
    creator: _cr,
    ...summary
  } = nft
  return summary
}

function allNfts() {
  return getScenario().emptyCatalog ? [] : db().nfts
}

export function findNft(id: string) {
  return allNfts().find((n) => n.id === id)
}

const NEW_RELEASE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export function listNfts(query: NftListQuery): NftListResponse {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  const term = query.q?.trim().toLowerCase()

  // Facetas são calculadas sobre o resultado da busca/aba, antes dos filtros,
  // para que os contadores mostrem quantos itens cada filtro traria.
  const base = allNfts().filter((nft) => {
    if (term && !`${nft.name} ${nft.collection.name}`.toLowerCase().includes(term)) return false
    if (
      query.tab === 'new' &&
      SEED_REFERENCE_DATE - Date.parse(nft.listedAt) > NEW_RELEASE_WINDOW_MS
    )
      return false
    if (query.tab === 'trending' && nft.popularity < 500) return false
    return true
  })

  const filtered = base.filter((nft) => {
    if (query.categories?.length && !query.categories.includes(nft.category)) return false
    if (query.networks?.length && !query.networks.includes(nft.network)) return false
    if (query.minPrice && compareEth(nft.price, query.minPrice) < 0) return false
    if (query.maxPrice && compareEth(nft.price, query.maxPrice) > 0) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case 'price-asc':
        return compareEth(a.price, b.price) || a.id.localeCompare(b.id)
      case 'price-desc':
        return compareEth(b.price, a.price) || a.id.localeCompare(b.id)
      case 'popular':
        return b.popularity - a.popularity || a.id.localeCompare(b.id)
      case 'name':
        return a.name.localeCompare(b.name, 'pt-BR')
      default:
        return Date.parse(b.listedAt) - Date.parse(a.listedAt) || a.id.localeCompare(b.id)
    }
  })

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const items = sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary)
  const prices = allNfts().map((n) => n.price)
  const min = prices.reduce((m, p) => (toWei(p) < toWei(m) ? p : m), prices[0] ?? '0')
  const max = prices.reduce((m, p) => (toWei(p) > toWei(m) ? p : m), prices[0] ?? '0')

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    facets: {
      categories: [...CATEGORIES]
        .map((id) => ({
          id,
          label: CATEGORY_LABELS[id],
          count: base.filter((n) => n.category === id).length,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      networks: NETWORKS.map((id) => ({
        id,
        label: NETWORK_LABELS[id],
        count: base.filter((n) => n.network === id).length,
      })),
      priceRange: { min, max },
    },
  }
}

export function featured(): FeaturedResponse | null {
  const nfts = allNfts()
  if (nfts.length === 0) return null
  const pick = (id: string) => nfts.find((n) => n.id === id) ?? nfts[0]
  return {
    hero: [pick('nft-001'), pick('nft-006'), pick('nft-007')].map(toSummary),
    spotlight: toSummary(pick('nft-002')),
  }
}

/**
 * Altera preço e/ou disponibilidade de edições. Incrementa a versão do NFT e
 * publica no barramento (que vira o evento `nft.updated`).
 */
export function updateEditions(
  nftId: string,
  changes: Array<{ editionId: string; price?: string; available?: number }>,
): NftDetail | undefined {
  const nft = db().nfts.find((n) => n.id === nftId)
  if (!nft) return undefined
  for (const change of changes) {
    const edition = nft.editions.find((e) => e.id === change.editionId)
    if (!edition) continue
    if (change.price !== undefined) edition.price = change.price
    if (change.available !== undefined) edition.available = Math.max(0, change.available)
  }
  recomputeNft(nft)
  persist()
  publish('nft.changed', nft)
  return nft
}

export function recomputeNft(nft: NftDetail) {
  nft.price = lowestAvailablePrice(nft.editions)
  nft.totalAvailable = nft.editions.reduce((sum, e) => sum + e.available, 0)
  nft.version += 1
}

export function findEdition(
  nftId: string,
  editionId: string,
): { nft: NftDetail; edition: Edition } | undefined {
  const nft = db().nfts.find((n) => n.id === nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition } : undefined
}
