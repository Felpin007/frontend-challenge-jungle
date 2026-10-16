import type { Quote } from '@/api/contracts'

/**
 * O que o usuário confirma na revisão: itens, quantidades, preços, cupom, taxa,
 * total e bloqueios. Duas cotações com a mesma chave valem o mesmo para ele
 * (o id e a validade da cotação não entram na comparação).
 */
export function quoteValuesKey(quote: Quote) {
  return JSON.stringify({
    lines: quote.lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice]),
    discount: quote.discount,
    fee: quote.networkFee,
    total: quote.total,
    coupon: quote.couponStatus,
    issues: quote.issues.map((i) => `${i.itemId}:${i.type}`).sort(),
  })
}

export const sameQuoteValues = (a: Quote, b: Quote) => quoteValuesKey(a) === quoteValuesKey(b)
