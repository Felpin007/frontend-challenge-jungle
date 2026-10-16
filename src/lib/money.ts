/**
 * Valores em ETH trafegam como strings decimais ("1.19") e todo cálculo
 * é feito em wei (inteiro, 18 casas) com bigint. Assim evitamos erros de
 * ponto flutuante como 0.1 + 0.2 = 0.30000000000000004.
 */
const DECIMALS = 18
const WEI_PER_ETH = 10n ** BigInt(DECIMALS)
const ETH_PATTERN = /^\d+(\.\d{1,18})?$/

export function isEthString(value: string): boolean {
  return ETH_PATTERN.test(value)
}

export function toWei(eth: string): bigint {
  if (!isEthString(eth)) throw new Error(`Valor ETH inválido: "${eth}"`)
  const [whole, fraction = ''] = eth.split('.')
  return BigInt(whole) * WEI_PER_ETH + BigInt(fraction.padEnd(DECIMALS, '0'))
}

/** Converte wei para string decimal sem zeros à direita ("1.190000" -> "1.19"). */
export function fromWei(wei: bigint): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const whole = abs / WEI_PER_ETH
  const fraction = (abs % WEI_PER_ETH).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

export function addEth(...values: string[]): string {
  return fromWei(values.reduce((sum, v) => sum + toWei(v), 0n))
}

export function subEth(a: string, b: string): string {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(eth: string, quantity: number): string {
  if (!Number.isInteger(quantity)) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(eth) * BigInt(quantity))
}

/** Aplica percentual inteiro (ex.: 10 = 10%) arredondando para baixo em wei. */
export function percentOf(eth: string, percent: number): string {
  return fromWei((toWei(eth) * BigInt(Math.round(percent * 100))) / 10_000n)
}

export function compareEth(a: string, b: string): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

/**
 * Formata para exibição com no mínimo 2 casas e no máximo `maxFraction`
 * (sem arredondar para cima: o valor exibido nunca é maior que o real).
 */
export function formatEth(eth: string, { maxFraction = 6, withUnit = true } = {}): string {
  const [whole, fraction = ''] = fromWei(toWei(eth)).split('.')
  const trimmed = fraction.slice(0, maxFraction).padEnd(2, '0')
  return `${whole}.${trimmed}${withUnit ? ' ETH' : ''}`
}
