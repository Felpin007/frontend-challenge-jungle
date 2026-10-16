/**
 * Contratos da API REST e dos eventos Socket.IO.
 *
 * Fonte única de verdade dos tipos: o cliente valida cada resposta com estes
 * schemas (zod) e os mocks MSW importam os mesmos tipos para montar as respostas.
 * Se o "servidor" mudar o formato, o erro aparece na fronteira de transporte,
 * não espalhado pela interface.
 */
import { z } from 'zod'
import { isEthString } from '@/lib/money'

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

export const EthAmount = z.string().refine(isEthString, 'Valor ETH deve ser string decimal')
export type EthAmount = z.infer<typeof EthAmount>

export const IsoDate = z.string()

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const Network = z.enum(NETWORKS)
export type Network = z.infer<typeof Network>

export const CATEGORIES = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export const Category = z.enum(CATEGORIES)
export type Category = z.infer<typeof Category>

export const WALLET_PROVIDERS = ['metamask', 'walletconnect', 'coinbase'] as const
export const WalletProvider = z.enum(WALLET_PROVIDERS)
export type WalletProvider = z.infer<typeof WalletProvider>

export const Image = z.object({ src: z.string(), alt: z.string() })
export type Image = z.infer<typeof Image>

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'AVAILABILITY_CONFLICT',
  'QUOTE_OUTDATED',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_REJECTED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const
export const ErrorCode = z.enum(ERROR_CODES)
export type ErrorCode = z.infer<typeof ErrorCode>

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    /** Erros por campo, usados para associar mensagens aos inputs do formulário. */
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

// ---------------------------------------------------------------------------
// Conta e sessão
// ---------------------------------------------------------------------------

export const User = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  ensName: z.string().nullable(),
  walletNickname: z.string().nullable(),
  createdAt: IsoDate,
})
export type User = z.infer<typeof User>

export const Session = z.object({ token: z.string(), expiresAt: IsoDate, user: User })
export type Session = z.infer<typeof Session>

export const SessionInfo = z.object({ expiresAt: IsoDate, user: User })
export type SessionInfo = z.infer<typeof SessionInfo>

export const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/
export const PASSWORD_RULES = 'Mínimo de 8 caracteres, com letra e número'
export const passwordSchema = z
  .string()
  .min(8, PASSWORD_RULES)
  .regex(/[A-Za-z]/, PASSWORD_RULES)
  .regex(/\d/, PASSWORD_RULES)

export const RegisterRequest = z.object({
  username: z
    .string()
    .trim()
    .regex(USERNAME_PATTERN, 'Use 3 a 24 caracteres: letras minúsculas, números, ponto ou _'),
  email: z.email('Informe um e-mail válido').trim().toLowerCase(),
  password: passwordSchema,
})
export type RegisterRequest = z.infer<typeof RegisterRequest>

export const LoginRequest = z.object({
  email: z.email('Informe um e-mail válido').trim().toLowerCase(),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginRequest = z.infer<typeof LoginRequest>

// ---------------------------------------------------------------------------
// NFTs
// ---------------------------------------------------------------------------

export const EDITION_KINDS = ['unique', 'limited', 'open'] as const
export const Edition = z.object({
  id: z.string(),
  label: z.string(), // "1/1", "1/10", "1/50", "ABERTA"
  kind: z.enum(EDITION_KINDS),
  supply: z.number().int().nullable(),
  available: z.number().int().min(0),
  price: EthAmount,
  maxPerOrder: z.number().int().min(1),
})
export type Edition = z.infer<typeof Edition>

export const NftSummary = z.object({
  id: z.string(),
  name: z.string(),
  tokenNumber: z.string(),
  image: Image,
  collection: z.object({ id: z.string(), name: z.string() }),
  category: Category,
  network: Network,
  /** Menor preço entre as edições disponíveis. */
  price: EthAmount,
  compareAtPrice: EthAmount.nullable(),
  badge: z.enum(['RARO']).nullable(),
  totalAvailable: z.number().int().min(0),
  listedAt: IsoDate,
  popularity: z.number(),
  /** Versão do recurso, usada para descartar eventos antigos. */
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof NftSummary>

export const NftDetail = NftSummary.extend({
  description: z.string(),
  longDescription: z.array(z.string()),
  attributes: z.array(z.string()),
  gallery: z.array(Image),
  editions: z.array(Edition),
  tokenId: z.string(),
  contract: z.string(),
  royaltiesPercent: z.number(),
  rating: z.object({ average: z.number(), count: z.number().int() }),
  creator: z.string(),
})
export type NftDetail = z.infer<typeof NftDetail>

export const SORT_OPTIONS = ['recent', 'price-asc', 'price-desc', 'popular', 'name'] as const
export const NftSort = z.enum(SORT_OPTIONS)
export type NftSort = z.infer<typeof NftSort>

export const CATALOG_TABS = ['all', 'new', 'trending'] as const
export const CatalogTab = z.enum(CATALOG_TABS)
export type CatalogTab = z.infer<typeof CatalogTab>

export const NftListQuery = z.object({
  q: z.string().optional(),
  categories: z.array(Category).optional(),
  networks: z.array(Network).optional(),
  minPrice: EthAmount.optional(),
  maxPrice: EthAmount.optional(),
  tab: CatalogTab.optional(),
  sort: NftSort.optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(48).optional(),
})
export type NftListQuery = z.infer<typeof NftListQuery>

export const Facet = z.object({ id: z.string(), label: z.string(), count: z.number().int() })

export const NftListResponse = z.object({
  items: z.array(NftSummary),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    categories: z.array(Facet),
    networks: z.array(Facet),
    priceRange: z.object({ min: EthAmount, max: EthAmount }),
  }),
})
export type NftListResponse = z.infer<typeof NftListResponse>

export const FeaturedResponse = z.object({
  hero: z.array(NftSummary),
  spotlight: NftSummary,
})
export type FeaturedResponse = z.infer<typeof FeaturedResponse>

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

export const FavoritesResponse = z.object({ nftIds: z.array(z.string()) })
export type FavoritesResponse = z.infer<typeof FavoritesResponse>

// ---------------------------------------------------------------------------
// Carrinho e cupom
// ---------------------------------------------------------------------------

export const CartItem = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenNumber: z.string(),
  image: Image,
  quantity: z.number().int().min(1),
  unitPrice: EthAmount,
  lineTotal: EthAmount,
  /** Quanto ainda há disponível nessa edição (já limitado por maxPerOrder). */
  maxQuantity: z.number().int().min(0),
  /** Preço registrado quando o item entrou no carrinho, se mudou desde então. */
  previousUnitPrice: EthAmount.nullable(),
  status: z.enum(['ok', 'price_changed', 'insufficient', 'sold_out']),
})
export type CartItem = z.infer<typeof CartItem>

export const Cart = z.object({
  id: z.string(),
  owner: z.enum(['guest', 'user']),
  items: z.array(CartItem),
  itemCount: z.number().int(),
  couponCode: z.string().nullable(),
  version: z.number().int(),
  updatedAt: IsoDate,
})
export type Cart = z.infer<typeof Cart>

export const AddCartItemRequest = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1),
})
export type AddCartItemRequest = z.infer<typeof AddCartItemRequest>

export const UpdateCartItemRequest = z.object({ quantity: z.number().int().min(1) })

export const ApplyCouponRequest = z.object({ code: z.string().trim().min(1, 'Informe o código') })

// ---------------------------------------------------------------------------
// Cotação
// ---------------------------------------------------------------------------

export const QuoteLine = z.object({
  itemId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenNumber: z.string(),
  image: Image,
  quantity: z.number().int(),
  unitPrice: EthAmount,
  lineTotal: EthAmount,
})
export type QuoteLine = z.infer<typeof QuoteLine>

export const QuoteIssue = z.object({
  itemId: z.string(),
  type: z.enum(['PRICE_CHANGED', 'INSUFFICIENT_AVAILABILITY', 'SOLD_OUT']),
  message: z.string(),
})
export type QuoteIssue = z.infer<typeof QuoteIssue>

export const Quote = z.object({
  id: z.string(),
  cartVersion: z.number().int(),
  network: Network,
  lines: z.array(QuoteLine),
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  coupon: z
    .object({ code: z.string(), description: z.string(), percentOff: z.number() })
    .nullable(),
  /** Situação do cupom salvo no carrinho, revalidado a cada cotação. */
  couponStatus: z.enum(['none', 'applied', 'invalid', 'expired']),
  /**
   * Avisos por item. SOLD_OUT e INSUFFICIENT_AVAILABILITY bloqueiam o pedido;
   * PRICE_CHANGED é informativo (o total já usa o preço novo).
   */
  issues: z.array(QuoteIssue),
  createdAt: IsoDate,
  expiresAt: IsoDate,
})
export type Quote = z.infer<typeof Quote>

export const QuoteRequest = z.object({ network: Network.optional() })

// ---------------------------------------------------------------------------
// Carteiras
// ---------------------------------------------------------------------------

export const WALLET_SLOTS = ['primary', 'secondary'] as const
export const WalletSlot = z.enum(WALLET_SLOTS)
export type WalletSlot = z.infer<typeof WalletSlot>

export const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/
export const ENS_LABEL = /^[a-z0-9-]{3,32}$/

export const WalletInput = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição').max(40),
  nickname: z.string().trim().min(2, 'Informe um apelido').max(24),
  network: Network,
  profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(40),
  address: z
    .string()
    .trim()
    .regex(ETH_ADDRESS, 'Endereço deve ter 0x seguido de 40 caracteres hexadecimais'),
  secondaryAddress: z.string().trim().max(64).nullable(),
  provider: WalletProvider,
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$/i, 'Código de indicação: 4 a 12 letras ou números'),
  email: z.email('Informe um e-mail válido').trim().toLowerCase(),
  ensName: z.string().trim().regex(ENS_LABEL, 'Nome ENS: 3 a 32 letras minúsculas, números ou -'),
})
export type WalletInput = z.infer<typeof WalletInput>

export const Wallet = WalletInput.extend({
  id: z.string(),
  slot: WalletSlot,
  createdAt: IsoDate,
  updatedAt: IsoDate,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletsResponse = z.object({
  primary: Wallet.nullable(),
  secondary: Wallet.nullable(),
})
export type WalletsResponse = z.infer<typeof WalletsResponse>

export const WalletSession = z.object({
  id: z.string(),
  walletId: z.string(),
  provider: WalletProvider,
  network: Network,
  address: z.string(),
  status: z.enum(['connected', 'disconnected']),
  connectedAt: IsoDate,
})
export type WalletSession = z.infer<typeof WalletSession>

export const ConnectWalletRequest = z.object({
  walletId: z.string(),
  provider: WalletProvider,
  network: Network,
})
export type ConnectWalletRequest = z.infer<typeof ConnectWalletRequest>

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const CollectorInfo = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição').max(40),
  username: z.string().trim().regex(USERNAME_PATTERN, 'Nome de usuário inválido'),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(40),
  email: z.email('Informe um e-mail válido').trim().toLowerCase(),
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$/i, 'Código de indicação: 4 a 12 letras ou números'),
  ensName: z.string().trim().regex(ENS_LABEL, 'Nome ENS: 3 a 32 letras minúsculas, números ou -'),
  note: z.string().trim().max(280, 'Máximo de 280 caracteres').optional(),
})
export type CollectorInfo = z.infer<typeof CollectorInfo>

export const CreateOrderRequest = z.object({
  quoteId: z.string(),
  walletSessionId: z.string(),
  collector: CollectorInfo,
})
export type CreateOrderRequest = z.infer<typeof CreateOrderRequest>

export const ORDER_STATUSES = ['pending', 'confirmed', 'declined'] as const
export const OrderStatus = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof OrderStatus>

export const Order = z.object({
  id: z.string(),
  number: z.string(),
  userId: z.string(),
  status: OrderStatus,
  version: z.number().int(),
  /** Snapshot imutável dos itens e valores no momento da compra. */
  lines: z.array(QuoteLine),
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  coupon: Quote.shape.coupon,
  network: Network,
  wallet: z.object({
    id: z.string(),
    nickname: z.string(),
    address: z.string(),
    provider: WalletProvider,
  }),
  transaction: z.object({ hash: z.string(), explorerUrl: z.string() }).nullable(),
  declineReason: z.string().nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
})
export type Order = z.infer<typeof Order>

export const OrdersResponse = z.object({ items: z.array(Order) })

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export const ProfileUpdateRequest = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição').max(40),
  username: z
    .string()
    .trim()
    .regex(USERNAME_PATTERN, 'Use 3 a 24 caracteres: letras minúsculas, números, ponto ou _'),
  email: z.email('Informe um e-mail válido').trim().toLowerCase(),
  ensName: z.string().trim().regex(ENS_LABEL, 'Nome ENS: 3 a 32 letras minúsculas, números ou -'),
  walletNickname: z.string().trim().min(2, 'Informe o apelido da carteira').max(24),
})
export type ProfileUpdateRequest = z.infer<typeof ProfileUpdateRequest>

export const AVATAR_MAX_BYTES = 1_000_000
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const AvatarUploadRequest = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Formato de imagem não suportado'),
})

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordSchema,
})
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>

// ---------------------------------------------------------------------------
// Eventos Socket.IO
// ---------------------------------------------------------------------------

/**
 * Todo evento carrega: eventId (identidade estável, para descartar duplicatas),
 * resource (recurso afetado) e version (para descartar eventos antigos).
 */
const envelope = <TType extends string, TData extends z.ZodType>(type: TType, data: TData) =>
  z.object({
    eventId: z.string(),
    type: z.literal(type),
    resource: z.object({ type: z.enum(['nft', 'order']), id: z.string() }),
    version: z.number().int(),
    occurredAt: IsoDate,
    data,
  })

export const NftUpdatedEvent = envelope(
  'nft.updated',
  z.object({
    nftId: z.string(),
    price: EthAmount,
    totalAvailable: z.number().int(),
    editions: z.array(Edition.pick({ id: true, price: true, available: true })),
  }),
)
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>

export const OrderUpdatedEvent = envelope(
  'order.updated',
  z.object({ orderId: z.string(), userId: z.string(), status: OrderStatus, order: Order }),
)
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>

export const REALTIME_EVENTS = { nftUpdated: 'nft.updated', orderUpdated: 'order.updated' } as const
