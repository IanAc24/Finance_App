import { todayString } from './dates'

export const currencies = [
  { code: 'CRC', symbol: '₡', labelKey: 'colones' },
  { code: 'USD', symbol: '$', labelKey: 'dollars' },
]

export function sum(amounts) {
  const total = amounts.reduce((a, b) => a + b, 0)
  return Math.round(total * 100) / 100
}

// Income, spent and net of the transactions in one currency
export function getTotals(transactions, code) {
  const list = transactions.filter((tx) => tx.currency === code)
  const income = sum(
    list.filter((tx) => tx.type === 'income').map((tx) => tx.amount),
  )
  const spent = sum(
    list.filter((tx) => tx.type === 'expense').map((tx) => tx.amount),
  )
  return { count: list.length, income, spent, net: sum([income, -spent]) }
}

// What is left split over the remaining days, rounded down so it stays safe:
// whole colones, or cents for dollars
export function safePerDay(net, days, code) {
  const cents = Math.floor(Math.round(net * 100) / days)
  return code === 'USD' ? cents / 100 : Math.floor(cents / 100)
}

// The largest amount the app accepts anywhere (a transaction, a budget, a
// savings move, a backup): one billion, in colones or dollars. It keeps every
// sum and every cents conversion far below Number.MAX_SAFE_INTEGER.
export const MAX_AMOUNT = 1_000_000_000
export const MAX_CENTS = MAX_AMOUNT * 100

// Colones are whole units in the app: true unless the currency is CRC and the
// amount has cents. Only for what is typed now; stored data is never judged
// by this (old data may have cents).
export function isWholeForCurrency(amount, currency) {
  return currency !== 'CRC' || Math.round(amount * 100) % 100 === 0
}

// The translation key of the message for a typed amount that cannot be used
// in this currency: cents in colones get their own message, anything else
// is just not an amount.
export function amountErrorKey(text, currency) {
  const amount = parseAmount(text)
  if (amount !== null && !isWholeForCurrency(amount, currency)) {
    return 'svAmountWholeColones'
  }
  return 'invalidAmount'
}

// True for a finite amount of at least one cent and at most MAX_AMOUNT
export function isValidAmount(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value <= MAX_AMOUNT &&
    Math.round(value * 100) > 0
  )
}

// Reads an amount typed the Costa Rican way. Empty means 0; null means the
// text is not a valid amount (not a number, negative, above MAX_AMOUNT, or a
// positive amount below one cent). The result is rounded to cents.
//   '1.500'      -> 1500      a dot followed by exactly three digits groups
//                             thousands: '1.500.000' -> 1500000
//   '1.500,50'   -> 1500.5    the comma is the decimal separator
//   '12,5'       -> 12.5
//   '12.5'/'9.99'-> 12.5/9.99 a dot followed by one or two digits is decimal
//                             (what the on-screen keypad types)
// Hexadecimal, scientific notation, signs, letters and stray separators are
// all rejected.
export function parseAmount(text) {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed === '') return 0

  let normalized
  if (/^\d+$/.test(trimmed)) {
    normalized = trimmed
  } else if (/^[1-9]\d{0,2}(\.\d{3})+(,\d{1,2})?$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+[.,]\d{1,2}$/.test(trimmed)) {
    normalized = trimmed.replace(',', '.')
  } else {
    return null
  }

  const value = Number(normalized)
  if (!Number.isFinite(value) || value > MAX_AMOUNT) return null
  const rounded = Math.round(value * 100) / 100
  return value > 0 && rounded === 0 ? null : rounded
}

// CRC: ₡1.800.000 (whole colones) | USD: $1,234.50 | negative: −₡31.000
// Colones are shown without decimals; the cents (if a backup brought any)
// stay in the data and in the CSV.
export function formatMoney(amount, currency = 'CRC') {
  if (currency === 'USD') {
    const sign = amount < 0 ? '−' : ''
    return (
      sign +
      '$' +
      Math.abs(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  }
  const whole = Math.round(Math.abs(amount))
  const sign = amount < 0 && whole > 0 ? '−' : ''
  return sign + '₡' + whole.toLocaleString('de-DE', { maximumFractionDigits: 0 })
}

// Total of the expenses (or of another `type`) in one currency dated after
// `today` (transactions are expected to be already limited to a period)
export function laterTotal(
  transactions,
  code,
  today = new Date(),
  type = 'expense',
) {
  const day = todayString(today)
  return sum(
    transactions
      .filter(
        (tx) => tx.type === type && tx.currency === code && tx.date > day,
      )
      .map((tx) => tx.amount),
  )
}
