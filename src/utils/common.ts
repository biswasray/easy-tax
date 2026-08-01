const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const groupFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
})

export const formatCurrency = (value: number) =>
  currencyFormatter.format(Math.round(value))

/** Keeps a second decimal for small rates, where 0.1% still matters. */
export const formatPercent = (fraction: number) =>
  `${(fraction * 100).toFixed(fraction >= 0.1 ? 1 : 2)}%`

export const formatRate = (rate: number) => `${Math.round(rate * 100)}%`

/** Groups the digits the user has typed, e.g. "1200000" -> "12,00,000". */
export const formatInputValue = (raw: string) => {
  if (raw === '' || raw === '-') return raw
  const negative = raw.startsWith('-')
  const digits = negative ? raw.slice(1) : raw
  return `${negative ? '-' : ''}${groupFormatter.format(Number(digits))}`
}

/**
 * Reduces whatever the user typed to bare digits, keeping a leading minus only
 * where a loss makes sense. Returning "-" on its own lets them type the sign
 * before the number.
 */
export const parseInputValue = (input: string, allowNegative: boolean) => {
  const negative = allowNegative && input.trimStart().startsWith('-')
  const digits = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (digits === '') return negative ? '-' : ''
  return `${negative ? '-' : ''}${digits}`
}

export const slabLabel = (from: number, to: number | null) => {
  if (to === null) return `Above ${formatCurrency(from)}`
  if (from === 0) return `Up to ${formatCurrency(to)}`
  return `${formatCurrency(from)} – ${formatCurrency(to)}`
}
