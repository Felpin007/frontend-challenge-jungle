import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, Wallet as WalletIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import type { Order, Quote, User, Wallet, WalletsResponse } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import type { ApiError } from '@/api/http'
import { EmptyState, ErrorState, errorMessage } from '@/components/feedback/States'
import { Container } from '@/components/layout/Container'
import { MobilePageHeader } from '@/components/layout/MobilePageHeader'
import { Button } from '@/components/ui/button'
import {
  useConnectWallet,
  useDisconnectWallet,
  useProfile,
  useWallets,
  useWalletSession,
} from '@/features/account/queries'
import { useStoredSession } from '@/features/auth/session-store'
import { hasBlockingIssues } from '@/features/cart/CartPage'
import { useCart, useQuote } from '@/features/cart/queries'
import { formatEth } from '@/lib/money'
import { CheckoutSummary } from './CheckoutSummary'
import { CheckoutFormSchema, CollectorFields, type CheckoutFormValues } from './CollectorFields'
import { PROVIDER_LABEL } from './labels'
import { quoteValuesKey, sameQuoteValues } from './quote-compare'
import { ReviewDialog } from './ReviewDialog'
import { loadAttempt, usePlaceOrder } from './use-place-order'
import { ConnectionPanel, ProviderOptions, SavedWalletsPicker } from './WalletSection'

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

/** Leva ao pedido criado; quando ele já existia (ORDER_PENDING), avisa o usuário. */
function useGoToOrder(onBeforeNavigate?: () => void) {
  const navigate = useNavigate()
  return useCallback(
    (order: Order, { existing }: { existing: boolean }) => {
      onBeforeNavigate?.()
      if (existing) toast.info('Você já tem um pedido em andamento. Acompanhe por aqui.')
      void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true })
    },
    [navigate, onBeforeNavigate],
  )
}

/** Página vazia, mas com tentativa salva (ex.: refresh no meio do envio): retoma o pedido. */
function PendingAttemptRecovery({ userId }: { userId: string }) {
  const place = usePlaceOrder(userId, useGoToOrder())
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
  const matches = Boolean(
    connected &&
    connected.walletId === selectedWallet.id &&
    connected.network === values.network &&
    connected.provider === values.provider,
  )

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

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(draftKey(userId))
    } catch {
      // ignorado
    }
    setReviewQuote(null)
  }, [userId])
  const place = usePlaceOrder(userId, useGoToOrder(clearDraft))

  // Refresh no meio do envio: reenvia a mesma tentativa (mesma chave) para recuperar o pedido.
  const { resume } = place
  useEffect(() => {
    resume()
  }, [resume])

  // Servidor recusou por cotação desatualizada: a revisão passa a mostrar a nova cotação.
  const outdated = place.state.status === 'outdated' ? place.state : null
  const dialogQuote = outdated?.quote ?? reviewQuote
  const dialogNotice = outdated?.message ?? reviewNotice

  // Revisão aberta e um evento em tempo real mudou preço, estoque, cupom ou taxa: a cotação
  // ativa é recalculada pela API e a revisão troca para ela, pedindo nova confirmação.
  // (Ajuste de estado durante a renderização, guardado pela chave da última cotação vista.)
  const liveQuote = quote.data
  const liveKey =
    liveQuote && !quote.isFetching ? `${liveQuote.id}:${quoteValuesKey(liveQuote)}` : null
  const [seenLiveKey, setSeenLiveKey] = useState<string | null>(null)
  if (dialogQuote && liveQuote && liveKey && liveKey !== seenLiveKey && !place.busy) {
    setSeenLiveKey(liveKey)
    const newer = Date.parse(liveQuote.createdAt) > Date.parse(dialogQuote.createdAt)
    if (
      newer &&
      liveQuote.network === dialogQuote.network &&
      !sameQuoteValues(liveQuote, dialogQuote)
    ) {
      setReviewQuote(liveQuote)
      setReviewNotice('Os valores mudaram enquanto você revisava o pedido.')
      place.reset()
    }
  }

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
    setReviewQuote(dialogQuote)
    setReviewNotice(dialogNotice)
    // Mesma cotação e mesmos dados de uma tentativa sem resposta: reaproveita a chave.
    void place.submit({ quoteId: dialogQuote.id, walletSessionId: connected.id, collector })
  }

  return (
    <div>
      <MobilePageHeader title="Pagamento com carteira" />
      <Container className="flex flex-col gap-4 max-lg:px-7 lg:gap-8 lg:pt-8">
        <nav aria-label="Trilha de navegação" className="hidden text-[15px] font-bold lg:block">
          <ol className="flex gap-2">
            <li>
              <Link to="/" className="hover:text-brand-accent">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/" hash="catalogo" className="hover:text-brand-accent">
                Mercado
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

        <form onSubmit={openReview} noValidate className="flex flex-col gap-4 lg:flex-row lg:gap-8">
          <SavedWalletsPicker
            wallets={wallets}
            selected={values.useSecondary && wallets.secondary ? 'secondary' : 'primary'}
            onSelect={(slot) => form.setValue('useSecondary', slot === 'secondary')}
          />

          <CollectorFields
            form={form}
            wallets={wallets}
            selectedWallet={selectedWallet}
            formError={formError}
          />

          {/* No mobile esta coluna "se desfaz" (display: contents) e cada bloco usa order */}
          <div className="flex w-full flex-col gap-6 max-lg:contents lg:w-[405px]">
            <CheckoutSummary quote={quote} />
            {blocking ? (
              <p role="alert" className="text-sm text-amber max-lg:order-4">
                Há itens esgotados ou com estoque insuficiente.{' '}
                <Link to="/carrinho" className="underline">
                  Ajuste o carrinho
                </Link>
                .
              </p>
            ) : null}

            <section
              aria-labelledby="wallet-network"
              className="flex flex-col gap-4 max-lg:order-2 max-lg:mt-3 lg:gap-5"
            >
              <h2 id="wallet-network" className="leading-4 font-bold lg:text-[17px]">
                Carteira e rede
              </h2>
              <ProviderOptions
                value={values.provider}
                onChange={(provider) => form.setValue('provider', provider)}
              />
              <ConnectionPanel
                provider={values.provider}
                network={values.network}
                wallet={selectedWallet}
                connected={matches}
                connecting={connect.isPending}
                error={connect.isError ? connect.error : null}
                onConnect={connectWallet}
                onDisconnect={() => connected && disconnect.mutate(connected.id)}
                disconnecting={disconnect.isPending}
              />
            </section>

            {/* Mobile: total e confirmação fixos no rodapé da tela (Figma) */}
            <div className="flex flex-col gap-4 max-lg:sticky max-lg:bottom-0 max-lg:z-20 max-lg:order-5 max-lg:-mx-7 max-lg:bg-background max-lg:px-7 max-lg:pt-4 max-lg:pb-8">
              <p className="flex items-baseline justify-end gap-7 leading-4 font-bold lg:hidden">
                <span>Total:</span>
                <span className="text-lg text-brand-accent" data-testid="mobile-total">
                  {quote.data ? formatEth(quote.data.total) : '…'}
                </span>
              </p>
              <Button
                type="submit"
                className="h-[60px] rounded-full bg-[linear-gradient(130deg,#d28a4c,rgb(210_138_76/0.8))] text-[15px] font-bold lg:h-[45px] lg:rounded-[8px] lg:bg-primary lg:bg-none"
                disabled={blocking || freshQuote.isPending || place.busy}
                data-testid="confirm-purchase"
              >
                {freshQuote.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Confirmar compra
              </Button>
            </div>
          </div>
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
    return 'Não conseguimos confirmar o pedido com o servidor. Seus itens continuam no carrinho. Tente de novo: a mesma tentativa será reaproveitada, sem duplicar a compra.'
  }
  return error.message
}
