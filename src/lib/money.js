const DEFAULT_LOCALE = 'en-US'
const DEFAULT_CURRENCY = 'EUR'
export const EUR_LV_RATE = 1.95583

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const normalized = String(value).trim().replace(/\s+/g, '')
  if (!normalized) return null

  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')
  let parsed = normalized

  if (hasComma && hasDot) {
    parsed = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '')
  } else if (hasComma) {
    const parts = normalized.split(',')
    parsed = parts.length === 2 && parts[1].length <= 2
      ? `${parts[0].replace(/,/g, '')}.${parts[1]}`
      : normalized.replace(/,/g, '')
  }

  const next = Number(parsed)
  return Number.isFinite(next) ? next : null
}

function formatNumber(value) {
  const numeric = toNumber(value)
  if (numeric === null) return ''
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric)
}

export function currencySymbol(currency = DEFAULT_CURRENCY) {
  if (currency === 'EUR') return '€'
  if (currency === 'BGN') return 'лв.'
  return currency || ''
}

export function normalizeMoneyValue(value) {
  return toNumber(value)
}

export function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  const numeric = toNumber(amount)
  if (numeric === null) return '—'
  const symbol = currencySymbol(currency)
  return symbol ? `${formatNumber(numeric)} ${symbol}` : formatNumber(numeric)
}

export function formatMoneyRange(min, max, currency = DEFAULT_CURRENCY) {
  if (min === '' && max === '') return '—'
  if (min !== '' && max !== '') return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
  if (min !== '') return `от ${formatMoney(min, currency)}`
  return `до ${formatMoney(max, currency)}`
}

export function formatDualCurrency(amount, rate = EUR_LV_RATE) {
  const numeric = toNumber(amount)
  if (numeric === null) return '—'
  return `${formatMoney(Math.round(numeric / rate), 'EUR')} / ${formatMoney(numeric, 'BGN')}`
}

export function formatDualCurrencyRange(min, max, rate = EUR_LV_RATE) {
  if (min === '' && max === '') return '—'
  if (min !== '' && max !== '') {
    return `${formatMoney(Math.round(Number(min) / rate), 'EUR')} – ${formatMoney(Math.round(Number(max) / rate), 'EUR')} · ${formatMoney(min, 'BGN')} – ${formatMoney(max, 'BGN')}`
  }
  if (min !== '') return `от ${formatDualCurrency(min, rate)}`
  return `до ${formatDualCurrency(max, rate)}`
}

function currencyFromToken(token = '') {
  const normalized = String(token).toLowerCase().replace(/\./g, '')
  if (normalized.includes('лв') || normalized === 'lv') return 'BGN'
  return 'EUR'
}

export function formatMoneyText(value) {
  const text = String(value ?? '')
  if (!text) return ''

  return text
    .replace(/(?:от|до)?\s*(\d[\d.,\s]*)\s*[-–]\s*(\d[\d.,\s]*)\s*(EUR|BGN|€|лв\.?|лв|lv\.?)\b/giu, (match, min, max, currencyToken) => {
      const currency = currencyFromToken(currencyToken)
      const prefix = match.trimStart().startsWith('до') ? 'до ' : match.trimStart().startsWith('от') ? 'от ' : ''
      return `${prefix}${formatMoneyRange(min, max, currency)}`
    })
    .replace(/(\d[\d.,\s]*)\s*(EUR|BGN|€|лв\.?|лв|lv\.?)\b/giu, (_, amount, currencyToken) => formatMoney(amount, currencyFromToken(currencyToken)))
}
