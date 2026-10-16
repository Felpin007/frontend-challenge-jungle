/**
 * Fixtures determinísticas. Tudo é derivado de um PRNG com semente fixa e de
 * uma data de referência fixa, então o mesmo seed sempre gera os mesmos dados
 * (importante para testes e regressão visual).
 */
import type { Category, Edition, Network, NftDetail, Wallet } from '@/api/contracts'
import { CATEGORIES, NETWORKS } from '@/api/contracts'
import { fromWei, toWei } from '@/lib/money'
import { hashPassword } from './crypto'
import {
  DB_SCHEMA_VERSION,
  type CartRecord,
  type CouponRecord,
  type DbState,
  type UserRecord,
} from './db'

/** Data de referência dos dados (não usamos "agora" para manter o seed estável). */
export const SEED_REFERENCE_DATE = Date.UTC(2026, 9, 1, 12, 0, 0)

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Art = 'emerald-ape' | 'sage-nomad' | 'golden-beat' | 'ivory-baron'

const ART_ALT: Record<Art, string> = {
  'emerald-ape': 'Macaco de pelo castanho com óculos redondos verdes e jaqueta college verde',
  'sage-nomad': 'Gorila grisalho com chapéu bucket verde-sálvia e moletom lilás',
  'golden-beat': 'Orangotango dourado com fones de ouvido verdes e jaqueta creme',
  'ivory-baron': 'Macaco de pelo preto com blazer marfim e gola alta verde',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

const COLLECTIONS = [
  { id: 'kurio-apes', name: 'Kurio Apes' },
  { id: 'kurio-editions', name: 'Kurio Editions' },
  { id: 'genesis-nomads', name: 'Genesis Nomads' },
  { id: 'golden-frequencies', name: 'Golden Frequencies' },
]

/** NFTs que aparecem no Figma, com nome, número, arte e preço do layout. */
const FIGMA_NFTS: Array<{
  name: string
  number: number
  art: Art
  price: string
  compareAt?: string
  rare?: boolean
}> = [
  { name: 'Emerald Ape', number: 42, art: 'emerald-ape', price: '1.19' },
  { name: 'Sage Nomad', number: 9, art: 'sage-nomad', price: '1.69' },
  {
    name: 'Neon Vessel',
    number: 552,
    art: 'ivory-baron',
    price: '1.99',
    compareAt: '2.29',
    rare: true,
  },
  { name: 'Cosmic Bloom', number: 118, art: 'sage-nomad', price: '1.29' },
  { name: 'Violet Nomad', number: 314, art: 'sage-nomad', price: '1.39' },
  { name: 'Ivory Baron', number: 88, art: 'ivory-baron', price: '1.79' },
  { name: 'Golden Beat', number: 207, art: 'golden-beat', price: '0.99' },
  { name: 'Golden Frequency', number: 71, art: 'golden-beat', price: '0.59' },
  { name: 'Golden Signal', number: 160, art: 'golden-beat', price: '0.39' },
]

const ADJECTIVES = [
  'Amber',
  'Cobalt',
  'Crimson',
  'Velvet',
  'Midnight',
  'Solar',
  'Lunar',
  'Copper',
  'Jade',
  'Onyx',
  'Silver',
  'Saffron',
  'Obsidian',
]
const NOUNS: Array<{ noun: string; art: Art }> = [
  { noun: 'Ape', art: 'emerald-ape' },
  { noun: 'Nomad', art: 'sage-nomad' },
  { noun: 'Baron', art: 'ivory-baron' },
  { noun: 'Beat', art: 'golden-beat' },
  { noun: 'Monk', art: 'sage-nomad' },
  { noun: 'Signal', art: 'golden-beat' },
  { noun: 'Drifter', art: 'emerald-ape' },
  { noun: 'Oracle', art: 'ivory-baron' },
]

export const TOTAL_NFTS = 48

function imageFor(art: Art, name: string) {
  return { src: `/nfts/${art}-800.webp`, alt: `${name}: ${ART_ALT[art]}` }
}

function scale(price: string, factor: number): string {
  // factor em centésimos para manter tudo inteiro em wei
  return fromWei((toWei(price) * BigInt(Math.round(factor * 100))) / 100n)
}

function buildEditions(id: string, price: string, pattern: number, rand: () => number): Edition[] {
  const limited = (label: string, supply: number, factor: number): Edition => {
    const available = Math.max(0, Math.round(supply * (0.2 + rand() * 0.8)))
    return {
      id: `${id}-${label.replace('/', '-')}`,
      label,
      kind: supply === 1 ? 'unique' : 'limited',
      supply,
      available: supply === 1 ? (rand() > 0.5 ? 1 : 0) : available,
      price: scale(price, factor),
      maxPerOrder: supply === 1 ? 1 : 10,
    }
  }
  const open: Edition = {
    id: `${id}-aberta`,
    label: 'ABERTA',
    kind: 'open',
    supply: null,
    available: 500,
    price,
    maxPerOrder: 20,
  }
  switch (pattern) {
    case 0:
      return [limited('1/1', 1, 4), limited('1/10', 10, 1.5), limited('1/50', 50, 1), open]
    case 1:
      return [limited('1/10', 10, 1.5), limited('1/50', 50, 1)]
    case 2:
      return [limited('1/1', 1, 1)]
    default:
      return [limited('1/50', 50, 1), open]
  }
}

export function lowestAvailablePrice(editions: Edition[]): string {
  const available = editions.filter((e) => e.available > 0)
  const pool = available.length ? available : editions
  return pool.reduce((min, e) => (toWei(e.price) < toWei(min) ? e.price : min), pool[0].price)
}

/** Edição disponível mais barata; em empate, prefere a limitada (como no Figma: 1/50). */
export function defaultEditionId(editions: Edition[]): string | null {
  const available = editions.filter((e) => e.available > 0)
  if (!available.length) return null
  const rank = (e: Edition) => (e.kind === 'open' ? 1 : 0)
  return available.reduce((best, e) => {
    const diff = toWei(e.price) - toWei(best.price)
    return diff < 0n || (diff === 0n && rank(e) < rank(best)) ? e : best
  }).id
}

function buildNfts(): NftDetail[] {
  const rand = mulberry32(20261016)
  const list: Array<{
    name: string
    number: number
    art: Art
    price: string
    compareAt?: string
    rare?: boolean
  }> = [...FIGMA_NFTS]
  let i = 0
  while (list.length < TOTAL_NFTS) {
    const adjective = ADJECTIVES[i % ADJECTIVES.length]
    const { noun, art } = NOUNS[(i * 3 + 1) % NOUNS.length]
    const name = `${adjective} ${noun}`
    i += 1
    if (list.some((n) => n.name === name)) continue
    // Faixa de preço do layout: 0,02 a 12,30 ETH
    const cents = Math.round(2 + rand() * rand() * 1228)
    list.push({
      name,
      number: 1 + Math.floor(rand() * 999),
      art,
      price: fromWei((BigInt(cents) * 10n ** 18n) / 100n),
      compareAt:
        rand() > 0.85 ? fromWei((BigInt(Math.round(cents * 1.2)) * 10n ** 18n) / 100n) : undefined,
      rare: rand() > 0.85,
    })
  }

  // Extremos da faixa de preço do layout ("Preço: 0,02 - 12,30 ETH")
  const PRICE_EXTREMES: Record<number, string> = { 30: '0.02', 41: '12.3' }
  for (const [index, price] of Object.entries(PRICE_EXTREMES)) {
    list[Number(index)] = { ...list[Number(index)], price, compareAt: undefined }
  }

  return list.map((entry, index) => {
    const id = `nft-${String(index + 1).padStart(3, '0')}`
    const tokenNumber = `#${String(entry.number).padStart(3, '0')}`
    const fullName = `${entry.name} ${tokenNumber}`
    const randomPattern = index === 0 ? 0 : Math.floor(rand() * 4)
    // Extremos de preço com edição aberta (sempre disponível): o preço exibido é o base
    const pattern = index in PRICE_EXTREMES ? 3 : randomPattern
    const editions = buildEditions(id, entry.price, pattern, rand)
    if (index === 0) {
      // Emerald Ape: igual ao Figma (1/50 selecionada a 1,19 ETH, 1/1 esgotada)
      editions[0].available = 0
    } else if (index < FIGMA_NFTS.length && editions.every((e) => e.available === 0)) {
      // NFTs que aparecem no layout começam com estoque
      editions[editions.length - 1].available = editions[editions.length - 1].supply ?? 1
    }
    const category: Category =
      index < FIGMA_NFTS.length ? 'arte-digital' : CATEGORIES[index % CATEGORIES.length]
    const network: Network = index < 4 ? 'ethereum' : NETWORKS[Math.floor(rand() * NETWORKS.length)]
    const collection =
      COLLECTIONS[entry.art === 'golden-beat' ? 3 : entry.art === 'sage-nomad' ? 2 : index % 2]
    const image = imageFor(entry.art, fullName)
    const listedAt = new Date(SEED_REFERENCE_DATE - index * 26 * 60 * 60 * 1000).toISOString()
    const traits = [
      'Óculos',
      'Esmeralda',
      'Raro',
      'Fones',
      'Chapéu',
      'Blazer',
      'Moletom',
      'Dourado',
    ]
    const attributes = [traits[index % traits.length], traits[(index + 3) % traits.length]]
    if (entry.rare) attributes.push('Raro')

    return {
      id,
      name: fullName,
      tokenNumber,
      image,
      collection,
      category,
      network,
      price: lowestAvailablePrice(editions),
      compareAtPrice: entry.compareAt ?? null,
      badge: entry.rare ? 'RARO' : null,
      totalAvailable: editions.reduce((sum, e) => sum + e.available, 0),
      defaultEditionId: defaultEditionId(editions),
      listedAt,
      popularity: Math.round(rand() * 1000),
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção ${collection.name}, verificado na ${NETWORK_LABELS[network]}, com arte desbloqueável e acesso para colecionadores.`,
      longDescription: [
        `${fullName} é uma obra digital finalizada à mão da coleção ${collection.name}. Cada atributo fica armazenado nos metadados do token e verificado na ${NETWORK_LABELS[network]}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
      ],
      attributes,
      gallery: [image, image, image, image].map((img, k) => ({
        ...img,
        alt: `${img.alt} (visualização ${k + 1})`,
      })),
      editions,
      tokenId: `#${String(entry.number).padStart(4, '0')}`,
      contract: `0x7A42…${(0x19e8 + index).toString(16).toUpperCase()}`,
      royaltiesPercent: 5,
      rating: (() => {
        const random = { average: Math.round((4 + rand()) * 10) / 10, count: 3 + Math.floor(rand() * 40) }
        return index === 0 ? { average: 4.8, count: 19 } : random // Emerald Ape: como no Figma
      })(),
      creator: index % 2 === 0 ? 'Nova Sato' : 'Íris Moura',
    } satisfies NftDetail
  })
}

const COUPONS: CouponRecord[] = [
  {
    code: 'KURIO10',
    description: '10% de desconto no lançamento',
    percentOff: 10,
    expiresAt: '2027-12-31T23:59:59.000Z',
  },
  {
    code: 'GENESIS5',
    description: '5% de desconto para colecionadores Genesis',
    percentOff: 5,
    expiresAt: '2027-12-31T23:59:59.000Z',
  },
  {
    code: 'VERAO25',
    description: 'Promoção de verão (encerrada)',
    percentOff: 25,
    expiresAt: '2026-03-31T23:59:59.000Z',
  },
]

export const SEED_PASSWORD = 'Kurio@2026'

const SEED_USERS = [
  {
    id: 'user-ana',
    email: 'ana@kurio.dev',
    username: 'ana.lima',
    displayName: 'Ana Lima',
    ensName: 'analima',
    walletNickname: 'Principal',
  },
  {
    id: 'user-bruno',
    email: 'bruno@kurio.dev',
    username: 'bruno.reis',
    displayName: 'Bruno Reis',
    ensName: 'brunoreis',
    walletNickname: 'Cofre',
  },
  {
    id: 'user-carla',
    email: 'carla@kurio.dev',
    username: 'carla.dias',
    displayName: 'Carla Dias',
    ensName: 'carladias',
    walletNickname: 'Minha carteira',
  },
]

function wallet(
  userId: string,
  slot: Wallet['slot'],
  data: Omit<Wallet, 'id' | 'slot' | 'createdAt' | 'updatedAt'>,
): Wallet & { userId: string } {
  const at = new Date(SEED_REFERENCE_DATE).toISOString()
  return { id: `wallet-${userId}-${slot}`, slot, userId, createdAt: at, updatedAt: at, ...data }
}

export async function createSeed(): Promise<DbState> {
  const created = new Date(SEED_REFERENCE_DATE - 90 * 24 * 60 * 60 * 1000).toISOString()
  const users: UserRecord[] = await Promise.all(
    SEED_USERS.map(async (u) => {
      const salt = `salt-${u.id}`
      return {
        ...u,
        avatarUrl: null,
        createdAt: created,
        salt,
        passwordHash: await hashPassword(SEED_PASSWORD, salt),
      }
    }),
  )

  const nfts = buildNfts()
  const at = new Date(SEED_REFERENCE_DATE).toISOString()
  const brunoCart: CartRecord = {
    id: 'cart-user-bruno',
    owner: { type: 'user', userId: 'user-bruno' },
    items: [
      {
        id: `${nfts[6].id}:${nfts[6].editions[0].id}`,
        nftId: nfts[6].id,
        editionId: nfts[6].editions[0].id,
        quantity: 1,
        addedUnitPrice: nfts[6].editions[0].price,
      },
    ],
    couponCode: null,
    version: 1,
    updatedAt: at,
  }

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    seq: 1000,
    eventSeq: 0,
    users,
    sessions: [],
    nfts,
    favorites: { 'user-ana': ['nft-001', 'nft-004'], 'user-bruno': ['nft-007'], 'user-carla': [] },
    carts: [brunoCart],
    coupons: COUPONS,
    quotes: [],
    wallets: [
      wallet('user-ana', 'primary', {
        displayName: 'Ana Lima',
        nickname: 'Principal',
        network: 'ethereum',
        profileName: 'Ana Coleciona',
        address: '0xA91F3c2B7d4E5f60718293a4b5C6d7E8f90AE82C',
        secondaryAddress: null,
        provider: 'metamask',
        referralCode: 'KURIO2026',
        email: 'ana@kurio.dev',
        ensName: 'analima',
      }),
      wallet('user-ana', 'secondary', {
        displayName: 'Ana Lima',
        nickname: 'Reserva',
        network: 'polygon',
        profileName: 'Ana Coleciona',
        address: '0x5B21aC0e9F8d7c6B5a4E3d2C1b0A9f8E7d6C5b4A',
        secondaryAddress: 'nova.kurio.eth',
        provider: 'coinbase',
        referralCode: 'KURIO2026',
        email: 'ana@kurio.dev',
        ensName: 'nova',
      }),
      wallet('user-bruno', 'primary', {
        displayName: 'Bruno Reis',
        nickname: 'Cofre',
        network: 'ethereum',
        profileName: 'Bruno Arte',
        address: '0x3C9e8B7a6D5f4E3c2B1a0F9e8D7c6B5a4F3e2D1c',
        secondaryAddress: null,
        provider: 'walletconnect',
        referralCode: 'BRUNO77',
        email: 'bruno@kurio.dev',
        ensName: 'brunoreis',
      }),
    ],
    walletSessions: [],
    orders: [],
    idempotency: {},
  }
}
