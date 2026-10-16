import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { CircleX, ExternalLink, Loader2, X } from 'lucide-react'
import type { Order } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import { ApiError } from '@/api/http'
import { queryKeys } from '@/api/query-keys'
import thankYouIcon from '@/assets/thank-you.svg'
import { NotFoundPage } from '@/components/feedback/NotFoundPage'
import { ErrorState } from '@/components/feedback/States'
import { Container } from '@/components/layout/Container'
import { NftImage } from '@/components/nft/NftImage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useStoredSession } from '@/features/auth/session-store'
import { NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from '@/features/checkout/labels'
import { formatEth } from '@/lib/money'

/** Formato do Figma: "29 Jul, 2026". */
function formatOrderDate(iso: string) {
  const date = new Date(iso)
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return `${date.getDate()} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${date.getFullYear()}`
}

/** Fallback se o socket estiver fora: consulta o pedido pendente a cada 5 s. */
const PENDING_POLL_MS = 5000

export function OrderPage({ orderId }: { orderId: string }) {
  const session = useStoredSession()
  const userId = session?.userId ?? 'anonymous'
  const query = useQuery({
    queryKey: queryKeys.user.order(userId, orderId),
    queryFn: ({ signal }) => ordersApi.get(orderId, { signal }),
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? PENDING_POLL_MS : false),
    enabled: Boolean(session),
  })
  // Sem sessão (expirou ou logout): o AuthWatcher já está levando ao login.
  if (!session) return null

  if (query.isPending) {
    return (
      <Container className="py-24" aria-busy="true">
        <p role="status" className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Carregando pedido…
        </p>
      </Container>
    )
  }
  if (query.isError) {
    if (
      query.error instanceof ApiError &&
      (query.error.code === 'NOT_FOUND' || query.error.code === 'FORBIDDEN')
    ) {
      return (
        <NotFoundPage
          title="Pedido não encontrado"
          description="Este pedido não existe ou não pertence à sua conta."
        />
      )
    }
    return (
      <Container className="py-16">
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </Container>
    )
  }
  return <OrderView order={query.data} />
}

function OrderView({ order }: { order: Order }) {
  const navigate = useNavigate()
  const close = () => void navigate({ to: order.status === 'declined' ? '/carrinho' : '/' })

  // Figma "Confirmação de Pedido": modal sobre fundo escuro que cobre a página
  // inteira. Dialog do Radix: foco preso, Esc fecha e o resto fica inerte.
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        overlayClassName="bg-background/95"
        showCloseButton={false}
        aria-describedby={undefined}
        // Foco inicial no próprio diálogo (e não no botão de fechar), sem anel de foco ao abrir
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement | null)?.focus()
        }}
        className="top-4 max-h-[calc(100dvh-2rem)] max-w-[578px] translate-y-0 gap-0 overflow-y-auto rounded-none border-0 bg-card p-0 sm:max-w-[578px] lg:top-[115px] lg:max-h-[calc(100dvh-130px)]"
        data-testid="order-status"
        data-status={order.status}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-sm text-primary"
          aria-label="Fechar"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <header
          className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center"
          aria-live="polite"
        >
          {order.status === 'confirmed' ? (
            <img src={thankYouIcon} alt="" width={80} height={80} />
          ) : order.status === 'declined' ? (
            <CircleX className="size-16 text-destructive" aria-hidden="true" />
          ) : (
            <Loader2 className="size-16 animate-spin text-primary" aria-hidden="true" />
          )}
          <DialogTitle asChild>
            <h1 className="text-base font-bold text-muted-foreground">
              {order.status === 'confirmed'
                ? 'Seus NFTs agora estão na sua carteira'
                : order.status === 'declined'
                  ? 'Pagamento recusado'
                  : 'Aguardando confirmação na rede…'}
            </h1>
          </DialogTitle>
          {order.status === 'pending' ? (
            <p className="text-sm text-muted-foreground">
              Você pode recarregar ou fechar esta página: o pedido {order.number} continua sendo
              processado e o status será atualizado aqui.
            </p>
          ) : null}
        </header>

        <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-[13px] whitespace-nowrap sm:flex sm:justify-between sm:divide-x sm:divide-primary sm:px-9 [&>div]:px-4 [&>div:first-child]:pl-0 [&>div:last-child]:pr-0">
          <div>
            <dt className="font-bold">{order.transaction ? 'ID da transação' : 'Pedido'}</dt>
            <dd className="text-muted-foreground" data-testid="order-reference">
              {order.transaction ? shortAddress(order.transaction.hash) : order.number}
            </dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd className="text-muted-foreground">{formatOrderDate(order.createdAt)}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd className="text-muted-foreground">{formatEth(order.total)}</dd>
          </div>
          <div>
            <dt className="font-bold">Carteira</dt>
            <dd className="text-muted-foreground">{PROVIDER_LABEL[order.wallet.provider]}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-4 px-6 py-6 sm:px-11">
          <h2 className="font-bold">Detalhes da transação</h2>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Itens do pedido {order.number}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="pb-2 text-base font-bold">
                  NFTs
                </th>
                <th scope="col" className="pb-2 text-center text-base font-bold">
                  Edições
                </th>
                <th scope="col" className="pb-2 text-right text-base font-bold">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.itemId}>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <NftImage
                        image={line.image}
                        alt=""
                        sizes="70px"
                        className="size-[66px] rounded-md"
                      />
                      <div>
                        <p className="text-base font-bold">{line.name}</p>
                        <p className="text-brand-secondary">ID do token: {line.tokenNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 text-center">(x {line.quantity})</td>
                  <td className="py-2 text-right text-lg font-bold text-brand-accent">
                    {formatEth(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto grid w-full max-w-[320px] grid-cols-2 gap-y-2 border-b border-border pb-3 text-[15px]">
            {order.discount !== '0' ? (
              <>
                <dt>Desconto</dt>
                <dd className="text-right">(-) {formatEth(order.discount)}</dd>
              </>
            ) : null}
            <dt>Taxa de rede</dt>
            <dd className="text-right text-lg">{formatEth(order.networkFee)}</dd>
            <dt className="font-bold">Total</dt>
            <dd
              className="text-right text-lg font-bold text-brand-accent"
              data-testid="order-total"
            >
              {formatEth(order.total)}
            </dd>
          </dl>

          {order.status === 'confirmed' && order.transaction ? (
            <>
              <p className="text-center text-sm leading-[22px] text-muted-foreground">
                Transação confirmada na {NETWORK_LABEL[order.network]}. A propriedade foi
                transferida para sua carteira conectada ({order.wallet.nickname}) e registrada na
                rede.
              </p>
              <Button asChild className="mx-auto h-12 px-4 text-base font-bold">
                <a href={order.transaction.explorerUrl} target="_blank" rel="noopener noreferrer">
                  Ver no Etherscan <ExternalLink className="size-4" aria-hidden="true" />
                  <span className="sr-only">(link de exploração simulado, abre em nova aba)</span>
                </a>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Referência e link de exploração simulados.
              </p>
            </>
          ) : null}

          {order.status === 'declined' ? (
            <>
              <p role="alert" className="text-center text-sm text-destructive">
                {order.declineReason ?? 'O pagamento não foi concluído.'} Nenhum valor foi cobrado e
                seus itens continuam no carrinho.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild variant="outline">
                  <Link to="/carrinho">Voltar ao carrinho</Link>
                </Button>
                <Button asChild>
                  <Link to="/pagamento">Tentar novamente</Link>
                </Button>
              </div>
            </>
          ) : null}

          {order.status === 'pending' ? (
            <p role="status" className="text-center text-sm text-brand-accent">
              Pedido {order.number} pendente. Não feche a carteira até a confirmação.
            </p>
          ) : null}
        </div>
        <div className="h-2.5 bg-primary" aria-hidden="true" />
      </DialogContent>
    </Dialog>
  )
}
