/**
 * As artes ficam em /nfts/<nome>-{400,800,1200}.webp. A partir do `src` padrão
 * (800) montamos o srcset para o navegador baixar só o tamanho necessário.
 */
const WIDTHS = [400, 800, 1200] as const

export function nftSrcSet(src: string): string | undefined {
  const match = src.match(/^(.*)-800\.webp$/)
  if (!match) return undefined
  return WIDTHS.map((w) => `${match[1]}-${w}.webp ${w}w`).join(', ')
}
