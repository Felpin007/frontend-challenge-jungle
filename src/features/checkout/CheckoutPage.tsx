import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { CircleCheck, Loader2, Unplug, Wallet as WalletIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  CollectorInfo,
  Network,
  NETWORKS,
  WALLET_PROVIDERS,
  WalletProvider,
  type Order,
  type Quote,
  type User,
  type Wallet,
  type WalletsResponse,
} from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { ApiError } from '@/api/http'
import { EmptyState, ErrorState, errorMessage } from '@/components/feedback/States'
import { Field, FormError } from '@/components/forms/Field'
import { Container } from '@/components/layout/Container'
import { MobilePageHeader } from '@/components/layout/MobilePageHeader'
import { NftImage } from '@/components/nft/NftImage'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useConnectWallet,
  useDisconnectWallet,
  useProfile,
  useWallets,
  useWalletSession,
} from '@/features/account/queries'
import { useStoredSession } from '@/features/auth/session-store'
import { CouponForm, QuoteTotals } from '@/features/cart/CartSummary'
import { hasBlockingIssues } from '@/features/cart/CartPage'
import { useCart, useQuote } from '@/features/cart/queries'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from './labels'
import { ReviewDialog } from './ReviewDialog'
import { loadAttempt, usePlaceOrder } from './use-place-order'

const CheckoutFormSchema = CollectorInfo.extend({
  network: Network,
  provider: WalletProvider,
  useSecondary: z.boolean(),
})
type CheckoutFormValues = z.infer<typeof CheckoutFormSchema>

const draftKey = (userId: string) => `kurio:checkout-draft:${userId}`

export function CheckoutPage() {
  const session = useStoredSession()
  const profile = useProfile()
  const wallets = useWallets()
  const cart = useCart()
  // Sem sessão (expirou ou logout): o AuthWatcher já está levando ao login.
  if (!session) return null
  const userId = session.userId

  if (profile.isPending || wallets.isPending || cart.isPending) {
    return (
      <Container className="py-16" aria-busy="true">
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Carregando pagamento…
        </p>
      </Container>
    )
  }
  const error = profile.error ?? wallets.error ?? cart.error
  if (error) {
    return (
      <Container className="py-16">
        <ErrorState
          error={error}
          onRetry={() => {
            void profile.refetch()
            void wallets.refetch()
            void cart.refetch()
          }}
        />
      </Container>
    )
  }
  if (!cart.data || cart.data.items.length === 0) {
    // Pode ser uma compra recém-confirmada: o pedido pendente é recuperado na tela do pedido.
    return (
      <Container className="py-16">
        <PendingAttemptRecovery userId={userId} />
        <EmptyState
          title="Nenhum item para pagar"
          description="Seu carrinho está vazio."
          action={
            <Button asChild>
              <Link to="/" hash="catalogo">
                Explorar NFTs
              </Link>
            </Button>
          }
        />
      </Container>
    )
  }
  if (!wallets.data?.primary) {
    return (
      <Container className="py-16">
        <EmptyState
          icon={<WalletIcon className="size-8 text-muted-foreground" aria-hidden="true" />}
          title="Cadastre uma carteira para pagar"
          description="As carteiras cadastradas ficam disponíveis no pagamento e recebem os NFTs comprados."
          action={
            <Button asChild>
              <Link to="/perfil/carteiras">Cadastrar carteira</Link>
            </Button>
          }
        />
      </Container>
    )
  }
  return <CheckoutForm userId={userId} user={profile.data!} wallets={wallets.data} />
}

/** Página vazia, mas com tentativa salva (ex.: refresh no meio do envio): retoma o pedido. */
function PendingAttemptRecovery({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const place = usePlaceOrder(
    userId,
    (order) =>
      void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true }),
  )
  const { resume } = place
  useEffect(() => {
    if (loadAttempt(userId)) resume()
  }, [resume, userId])
  if (!place.busy) return null
  return (
    <p role="status" className="mb-6 flex items-center gap-2 text-brand-accent">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Recuperando seu pedido…
    </p>
  )
}

function CheckoutForm({
  userId,
  user,
  wallets,
}: {
  userId: string
  user: User
  wallets: WalletsResponse
}) {
  const navigate = useNavigate()
  const primary = wallets.primary as Wallet
  const defaults = useMemo<CheckoutFormValues>(() => {
    const base: CheckoutFormValues = {
      displayName: user.displayName,
      username: user.username,
      profileName: primary.profileName,
      email: user.email,
      referralCode: primary.referralCode,
      ensName: user.ensName ?? primary.ensName,
      note: '',
      network: primary.network,
      provider: primary.provider,
      useSecondary: false,
    }
    try {
      // Rascunho salvo (ex.: sessão expirou no meio do checkout): retoma de onde parou.
      const draft = sessionStorage.getItem(draftKey(userId))
      return draft ? { ...base, ...(JSON.parse(draft) as Partial<CheckoutFormValues>) } : base
    } catch {
      return base
    }
  }, [user, primary, userId])

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(CheckoutFormSchema),
    defaultValues: defaults,
  })
  const { errors } = form.formState
  const values = useWatch({ control: form.control }) as CheckoutFormValues
  const selectedWallet = values.useSecondary && wallets.secondary ? wallets.secondary : primary

  useEffect(() => {
    // Salva o rascunho a cada alteração (retomada após sessão expirada ou refresh).
    return form.subscribe({
      formState: { values: true },
      callback: ({ values: draft }) => {
        try {
          sessionStorage.setItem(draftKey(userId), JSON.stringify(draft))
        } catch {
          // ignorado
        }
      },
    })
  }, [form, userId])

  const cart = useCart()
  const quote = useQuote(values.network, cart.data)
  const blocking = cart.data ? hasBlockingIssues(cart.data) : false

  // ------------------------------------------------------------ Carteira
  const walletSession = useWalletSession()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const connected = walletSession.data
  const matches =
    connected &&
    connected.walletId === selectedWallet.id &&
    connected.network === values.network &&
    connected.provider === values.provider

  // Mudou carteira, rede ou tipo: a conexão anterior deixa de valer.
  const { mutate: disconnectWallet, isPending: disconnecting } = disconnect
  useEffect(() => {
    if (connected && !matches && !disconnecting) {
      disconnectWallet(connected.id)
      toast.info('Carteira desconectada: conecte novamente com a nova seleção.')
    }
  }, [connected, matches, disconnecting, disconnectWallet])

  function connectWallet() {
    connect.mutate(
      { walletId: selectedWallet.id, provider: values.provider, network: values.network },
      { onSuccess: () => toast.success(`${PROVIDER_LABEL[values.provider]} conectada.`) },
    )
  }

  // ------------------------------------------------------------ Revisão e envio
  const [reviewQuote, setReviewQuote] = useState<Quote | null>(null)
  const [reviewNotice, setReviewNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const freshQuote = useMutation({ mutationFn: () => cartApi.quote(values.network) })

  const place = usePlaceOrder(userId, (order: Order) => {
    try {
      sessionStorage.removeItem(draftKey(userId))
    } catch {
      // ignorado
    }
    setReviewQuote(null)
    void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true })
  })

  // Refresh no meio do envio: reenvia a mesma tentativa (mesma chave) para recuperar o pedido.
  const { resume } = place
  useEffect(() => {
    resume()
  }, [resume])

  // Servidor recusou por cotação desatualizada: a revisão passa a mostrar a nova cotação.
  const outdated = place.state.status === 'outdated' ? place.state : null
  const dialogQuote = outdated?.quote ?? reviewQuote
  const dialogNotice = outdated?.message ?? reviewNotice

  const openReview = form.handleSubmit(async () => {
    setFormError(null)
    if (!matches) {
      setFormError('Conecte a carteira selecionada antes de confirmar a compra.')
      return
    }
    try {
      const q = await freshQuote.mutateAsync()
      setReviewNotice(null)
      place.reset()
      setReviewQuote(q)
    } catch (error) {
      setFormError(errorMessage(error, 'Não foi possível revalidar os valores. Tente novamente.'))
    }
  })

  function confirm() {
    if (!dialogQuote || !connected) return
    const { network: _n, provider: _p, useSecondary: _u, ...collector } = form.getValues()
    // Nova confirmação = nova chave de idempotência (o conteúdo mudou se a cotação mudou).
    setReviewQuote(dialogQuote)
    setReviewNotice(dialogNotice)
    void place.submit({ quoteId: dialogQuote.id, walletSessionId: connected.id, collector })
  }

  const field = (name: keyof CheckoutFormValues) => errors[name]?.message as string | undefined

  return (
    <div>
      <MobilePageHeader title="Pagamento com carteira" />
      <Container className="flex flex-col gap-6 lg:pt-8">
        <nav aria-label="Trilha de navegação" className="hidden text-[15px] font-bold lg:block">
          <ol className="flex gap-2">
            <li>
              <Link to="/" className="hover:text-brand-accent">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/carrinho" className="hover:text-brand-accent">
                Carrinho
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Pagamento</li>
          </ol>
        </nav>
        <h1 className="sr-only max-lg:hidden">Pagamento</h1>

        {place.state.status === 'recovering' ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md border border-primary/50 px-3 py-2 text-brand-accent"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Confirmando seu pedido com o servidor (tentativa {place.state.attempt + 1}). Nenhuma
            compra será duplicada.
          </p>
        ) : null}

        <form
          onSubmit={openReview}
          noValidate
          className="flex flex-col gap-10 lg:flex-row lg:gap-8"
        >
          <section aria-labelledby="collector-title" className="flex flex-1 flex-col gap-4">
            <h2 id="collector-title" className="text-lg font-bold">
              Perfil do colecionador
            </h2>
            <FormError message={formError} />
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Nome de exibição" required error={field('displayName')}>
                {(p) => <Input {...p} autoComplete="name" {...form.register('displayName')} />}
              </Field>
              <Field label="Nome de usuário" required error={field('username')}>
                {(p) => <Input {...p} autoComplete="username" {...form.register('username')} />}
              </Field>
              <Field label="Rede" required error={field('network')}>
                {(p) => (
                  <Controller
                    control={form.control}
                    name="network"
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger {...p} className="h-10 w-full" data-testid="network-select">
                          <SelectValue placeholder="Selecione uma rede" />
                        </SelectTrigger>
                        <SelectContent>
                          {NETWORKS.map((n) => (
                            <SelectItem key={n} value={n}>
                              {NETWORK_LABEL[n]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
              <Field label="Nome do perfil" required error={field('profileName')}>
                {(p) => <Input {...p} {...form.register('profileName')} />}
              </Field>
              <Field
                label="Endereço da carteira"
                required
                hint={`Carteira ${selectedWallet.slot === 'primary' ? 'principal' : 'secundária'}: ${selectedWallet.nickname}`}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={selectedWallet.address}
                    readOnly
                    className="text-muted-foreground"
                  />
                )}
              </Field>
              <Field label="ENS ou carteira secundária (opcional)">
                {(p) => (
                  <Input
                    {...p}
                    value={selectedWallet.secondaryAddress ?? ''}
                    readOnly
                    placeholder="Não informado"
                    className="text-muted-foreground"
                  />
                )}
              </Field>
              <Field label="Tipo de carteira" required error={field('provider')}>
                {(p) => (
                  <Controller
                    control={form.control}
                    name="provider"
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger {...p} className="h-10 w-full" data-testid="provider-select">
                          <SelectValue placeholder="Selecione uma carteira" />
                        </SelectTrigger>
                        <SelectContent>
                          {WALLET_PROVIDERS.map((w) => (
                            <SelectItem key={w} value={w}>
                              {PROVIDER_LABEL[w]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
              <Field label="Código de indicação" required error={field('referralCode')}>
                {(p) => <Input {...p} {...form.register('referralCode')} />}
              </Field>
              <Field label="E-mail" required error={field('email')}>
                {(p) => (
                  <Input {...p} type="email" autoComplete="email" {...form.register('email')} />
                )}
              </Field>
              <Field label="Nome ENS" required error={field('ensName')}>
                {(p) => (
                  <div className="flex gap-2">
                    <span
                      className="grid h-10 place-items-center rounded-[3px] border border-input px-3 text-[15px]"
                      aria-hidden="true"
                    >
                      .eth
                    </span>
                    <Input {...p} {...form.register('ensName')} />
                  </div>
                )}
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="useSecondary"
                render={({ field: f }) => (
                  <Checkbox
                    id="use-secondary"
                    checked={f.value}
                    onCheckedChange={(checked) => f.onChange(checked === true)}
                    disabled={!wallets.secondary}
                    className="rounded-full"
                  />
                )}
              />
              <Label htmlFor="use-secondary" className="text-base font-normal">
                Usar outra carteira?
              </Label>
              {!wallets.secondary ? (
                <Link to="/perfil/carteiras" className="text-sm text-brand-accent hover:underline">
                  Cadastrar carteira secundária
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">
                  ({wallets.secondary.nickname})
                </span>
              )}
            </div>
            <Field
              label="Observação do colecionador (opcional)"
              error={field('note')}
              className="max-w-[350px]"
            >
              {(p) => <Textarea {...p} rows={6} {...form.register('note')} />}
            </Field>
          </section>

          <aside aria-labelledby="your-nfts" className="flex w-full flex-col gap-4 lg:w-[405px]">
            <h2 id="your-nfts" className="text-lg font-bold">
              Seus NFTs
            </h2>
            <div className="flex justify-between font-bold" aria-hidden="true">
              <span>NFTs</span>
              <span>Subtotal</span>
            </div>
            <ul className="flex flex-col gap-3" aria-label="Itens do pedido">
              {(quote.data?.lines ?? []).map((line) => (
                <li key={line.itemId} className="flex items-center gap-3 bg-card p-1 pr-3">
                  <NftImage
                    image={line.image}
                    alt=""
                    sizes="70px"
                    className="size-[66px] rounded-md"
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="font-bold">{line.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ID do token: {line.tokenNumber} · {line.editionLabel}
                    </span>
                  </div>
                  <span className="text-sm">(x {line.quantity})</span>
                  <span className="text-lg font-bold text-brand-accent">
                    {formatEth(line.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
            <CouponToggle />
            <QuoteTotals
              quote={quote.data}
              loading={quote.isPending}
              updating={quote.isFetching && quote.isPlaceholderData}
            />
            {blocking ? (
              <p role="alert" className="text-sm text-amber">
                Há itens esgotados ou com estoque insuficiente.{' '}
                <Link to="/carrinho" className="underline">
                  Ajuste o carrinho
                </Link>
                .
              </p>
            ) : null}

            <section aria-labelledby="wallet-network" className="flex flex-col gap-3">
              <h3 id="wallet-network" className="text-center text-lg font-bold">
                Carteira e rede
              </h3>
              <div
                className={cn(
                  'flex flex-col gap-3 border p-4',
                  matches ? 'border-success' : 'border-border',
                )}
                data-testid="wallet-connection"
              >
                <p className="text-sm">
                  {PROVIDER_LABEL[values.provider]} · Rede {NETWORK_LABEL[values.network]} ·{' '}
                  {shortAddress(selectedWallet.address)}
                </p>
                <p aria-live="polite" className="text-sm">
                  {connect.isPending ? (
                    <span className="flex items-center gap-2 text-brand-accent">
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Aguardando
                      aprovação na carteira…
                    </span>
                  ) : matches ? (
                    <span className="flex items-center gap-2 text-success">
                      <CircleCheck className="size-4" aria-hidden="true" /> Carteira conectada
                    </span>
                  ) : connect.isError ? (
                    <span className="text-destructive">
                      {errorMessage(connect.error, 'Não foi possível conectar.')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Carteira desconectada</span>
                  )}
                </p>
                {matches && connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => disconnect.mutate(connected.id)}
                    disabled={disconnect.isPending}
                  >
                    <Unplug className="size-4" aria-hidden="true" /> Desconectar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={connectWallet}
                    disabled={connect.isPending}
                    data-testid="connect-wallet"
                  >
                    {connect.isError ? 'Tentar conectar novamente' : 'Conectar carteira'}
                  </Button>
                )}
              </div>
            </section>

            <Button
              type="submit"
              className="h-14 rounded-full text-base font-bold max-lg:bg-linear-to-r max-lg:from-primary max-lg:to-[#b8743d] lg:h-[45px] lg:rounded-[3px]"
              disabled={blocking || freshQuote.isPending || place.busy}
              data-testid="confirm-purchase"
            >
              {freshQuote.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Confirmar compra
            </Button>
          </aside>
        </form>
      </Container>

      <ReviewDialog
        quote={dialogQuote}
        notice={dialogNotice}
        wallet={selectedWallet}
        provider={values.provider}
        collectorName={values.displayName}
        state={place.state}
        busy={place.busy}
        onConfirm={confirm}
        onClose={() => {
          if (place.busy) return
          setReviewQuote(null)
          place.reset()
        }}
        errorText={place.state.status === 'error' ? errorText(place.state.error) : null}
      />
    </div>
  )
}

function errorText(error: ApiError) {
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
    return 'Não conseguimos confirmar o pedido com o servidor. Seus itens continuam no carrinho; tente novamente — a mesma tentativa será reaproveitada, sem duplicar a compra.'
  }
  return error.message
}

function CouponToggle() {
  const [open, setOpen] = useState(false)
  const { data: cart } = useCart()
  if (!cart) return null
  if (open || cart.couponCode) return <CouponForm cart={cart} />
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-center text-[15px] hover:text-brand-accent"
    >
      Tem um código promocional? <span className="underline">Aplique aqui</span>
    </button>
  )
}
