import type { UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import type { Quote } from '@/api/contracts'
import { NftImage } from '@/components/nft/NftImage'
import { CouponForm, QuoteSummary } from '@/features/cart/CartSummary'
import { useCart } from '@/features/cart/queries'
import { formatEth } from '@/lib/money'

/** Desktop (Figma "Seus NFTs"): itens da cotação, cupom e resumo de valores. */
export function CheckoutSummary({ quote }: { quote: UseQueryResult<Quote> }) {
  return (
    <div className="flex flex-col gap-3 max-lg:hidden">
      <h2 id="your-nfts" className="text-[17px] leading-4 font-bold">
        Seus NFTs
      </h2>
      <div
        className="flex justify-between border-b border-border pb-3 font-bold"
        aria-hidden="true"
      >
        <span>NFTs</span>
        <span>Subtotal</span>
      </div>
      <ul className="flex flex-col gap-3" aria-label="Itens do pedido">
        {(quote.data?.lines ?? []).map((line) => (
          <li key={line.itemId} className="flex items-center gap-2 bg-card p-1 pr-3">
            <NftImage image={line.image} alt="" sizes="70px" className="size-[66px] rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold">{line.name}</span>
              <span className="text-sm text-brand-secondary">ID do token: {line.tokenNumber}</span>
            </div>
            <span className="text-sm text-muted-foreground">(x {line.quantity})</span>
            <span className="text-lg font-bold text-brand-accent">{formatEth(line.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <CouponToggle />
      <QuoteSummary quote={quote} />
    </div>
  )
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
