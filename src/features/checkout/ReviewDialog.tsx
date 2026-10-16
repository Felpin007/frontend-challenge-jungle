import { Link } from '@tanstack/react-router'
import { Loader2, TriangleAlert } from 'lucide-react'
import type { Quote, Wallet, WalletProvider } from '@/api/contracts'
import { NftImage } from '@/components/nft/NftImage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QuoteTotals } from '@/features/cart/CartSummary'
import { formatEth } from '@/lib/money'
import { NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from './labels'
import type { PlaceOrderState } from './use-place-order'

/**
 * Revisão antes do envio: mostra a cotação recém-revalidada. Se o servidor
 * responder que preço/estoque/cupom/taxa mudaram, a nova cotação aparece aqui
 * com o aviso e o usuário precisa confirmar de novo.
 */
export function ReviewDialog({
  quote,
  notice,
  wallet,
  provider,
  collectorName,
  state,
  busy,
  errorText,
  onConfirm,
  onClose,
}: {
  quote: Quote | null
  notice: string | null
  wallet: Wallet
  provider: WalletProvider
  collectorName: string
  state: PlaceOrderState
  busy: boolean
  errorText: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  const blockingIssues = quote?.issues.filter((i) => i.type !== 'PRICE_CHANGED') ?? []
  return (
    <Dialog open={Boolean(quote)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-0 bg-card sm:max-w-[560px]"
        data-testid="review-dialog"
      >
        <DialogHeader>
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription>
            Confira os valores atualizados. A compra só é enviada quando você confirmar.
          </DialogDescription>
        </DialogHeader>
        {quote ? (
          <div className="flex flex-col gap-4">
            {notice ? (
              <p
                role="alert"
                className="flex gap-2 rounded-md border border-amber/50 bg-amber/10 p-3 text-sm text-amber"
                data-testid="quote-changed"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{notice} Confirme novamente para continuar.</span>
              </p>
            ) : null}
            <ul className="flex flex-col gap-2" aria-label="Itens">
              {quote.lines.map((line) => (
                <li key={line.itemId} className="flex items-center gap-3 text-sm">
                  <NftImage image={line.image} alt="" sizes="48px" className="size-12 rounded-md" />
                  <span className="flex-1">
                    <strong>{line.name}</strong> · {line.editionLabel}
                    <br />
                    <span className="text-muted-foreground">
                      {line.quantity} × {formatEth(line.unitPrice)}
                    </span>
                  </span>
                  <span className="font-bold text-brand-accent">{formatEth(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {quote.issues.length ? (
              <ul className="flex flex-col gap-1 text-sm text-amber" aria-label="Avisos">
                {quote.issues.map((issue) => (
                  <li key={`${issue.itemId}-${issue.type}`}>• {issue.message}</li>
                ))}
              </ul>
            ) : null}
            <QuoteTotals quote={quote} loading={false} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Carteira</dt>
              <dd>
                {wallet.nickname} · {PROVIDER_LABEL[provider]} · {shortAddress(wallet.address)}
              </dd>
              <dt className="text-muted-foreground">Rede</dt>
              <dd>{NETWORK_LABEL[quote.network]}</dd>
              <dt className="text-muted-foreground">Colecionador</dt>
              <dd>{collectorName}</dd>
            </dl>
            {errorText ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {errorText}
              </p>
            ) : null}
            {state.status === 'recovering' ? (
              <p role="status" className="text-sm text-brand-accent">
                O servidor demorou a responder. Verificando o pedido com a mesma tentativa…
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          {blockingIssues.length ? (
            <Button asChild variant="outline">
              <Link to="/carrinho">Ajustar carrinho</Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy || blockingIssues.length > 0}
            data-testid="confirm-order"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? 'Enviando…' : notice ? 'Confirmar novos valores' : 'Confirmar e pagar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
