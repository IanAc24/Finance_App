import { isValidDate, todayString } from './dates'
import { currencies } from './money'

// Where an income came from. Only meaningful for transactions of type
// 'income'; expenses keep source = null.
export const INCOME_SOURCES = ['salary', 'freelance', 'gift', 'other']

// A known source, or null (missing, damaged or not an income source)
export function normalizeSource(value) {
  return INCOME_SOURCES.includes(value) ? value : null
}

// The source a transaction is saved with: only an income has one
export function sourceFor(tx) {
  return tx?.type === 'income' ? normalizeSource(tx.source) : null
}

// A day as YYYY-MM-DD from a string or a Date; anything else is null
function asDay(value) {
  if (value instanceof Date) return todayString(value)
  return typeof value === 'string' && isValidDate(value) ? value : null
}

const toCents = (amount) => Math.round(amount * 100)

// Income in one period (both ends included, YYYY-MM-DD strings or Dates;
// a missing end is open), per currency, never mixing currencies:
//   { CRC: { total, totalCents, count, bySource }, USD: { ... } }
// bySource has a total for every source in INCOME_SOURCES plus `none` (income
// saved without a source). Sums are done in whole cents.
export function incomeSummary(transactions, { from, to } = {}) {
  const start = asDay(from)
  const end = asDay(to)
  const result = {}
  for (const { code } of currencies) {
    const cents = { none: 0 }
    for (const source of INCOME_SOURCES) cents[source] = 0
    let count = 0
    let totalCents = 0
    for (const tx of transactions) {
      if (tx.type !== 'income' || tx.currency !== code) continue
      if ((start && tx.date < start) || (end && tx.date > end)) continue
      const amount = toCents(tx.amount)
      totalCents += amount
      cents[normalizeSource(tx.source) ?? 'none'] += amount
      count += 1
    }
    result[code] = {
      total: totalCents / 100,
      totalCents,
      count,
      bySource: Object.fromEntries(
        Object.entries(cents).map(([key, value]) => [key, value / 100]),
      ),
    }
  }
  return result
}

// The { from, to } days (YYYY-MM-DD, both included) of a period:
//   'month'         the calendar month of `today`
//   'year'          the calendar year of `today`
//   { from, to }    a custom period (swapped if given backwards)
// null when a custom period has an invalid day.
export function periodRange(kind, today = new Date()) {
  if (kind === 'month') {
    const year = today.getFullYear()
    const month = today.getMonth()
    return {
      from: todayString(new Date(year, month, 1)),
      to: todayString(new Date(year, month + 1, 0)),
    }
  }
  if (kind === 'year') {
    const year = today.getFullYear()
    return {
      from: todayString(new Date(year, 0, 1)),
      to: todayString(new Date(year, 11, 31)),
    }
  }
  const from = asDay(kind?.from)
  const to = asDay(kind?.to)
  if (!from || !to) return null
  return from <= to ? { from, to } : { from: to, to: from }
}
