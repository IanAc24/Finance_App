import { getTotals, sum } from './money'
import { getQuincenaRange, parseDate } from './dates'
import { DEFAULT_SCHEDULE } from './quincenaSchedule'

// Note on the savings move made from a leftover offer; it is stored as text,
// so it is one fixed language rather than a translation
export const ROLLOVER_NOTE = 'Sobrante de la quincena'

// Device pref key that remembers a skipped leftover offer, one per currency
export const rolloverSkipKey = (code) => `rolloverSkipped.${code}`

// What is in savings in one currency: everything moved in minus everything
// taken out
export function savingsBalance(moves, code) {
  const list = moves.filter((move) => move.currency === code)
  const moved = sum(
    list.filter((move) => move.direction === 'in').map((move) => move.amount),
  )
  const taken = sum(
    list.filter((move) => move.direction === 'out').map((move) => move.amount),
  )
  return sum([moved, -taken])
}

// Moves of one currency dated inside a period
export function savingsInRange(moves, code, start, end) {
  const list = moves.filter((move) => {
    const date = parseDate(move.date)
    return move.currency === code && date >= start && date <= end
  })
  return {
    toSavings: sum(
      list.filter((move) => move.direction === 'in').map((move) => move.amount),
    ),
    fromSavings: sum(
      list.filter((move) => move.direction === 'out').map((move) => move.amount),
    ),
  }
}

// What a period really had left in one currency:
// income - spent - moved to savings + taken from savings
export function leftInRange(transactions, moves, code, start, end) {
  const inRange = transactions.filter((tx) => {
    const date = parseDate(tx.date)
    return date >= start && date <= end
  })
  const { net } = getTotals(inRange, code)
  const { toSavings, fromSavings } = savingsInRange(moves, code, start, end)
  return sum([net, -toSavings, fromSavings])
}

// The quincena before the one containing `today`
export function previousQuincenaRange(today = new Date(), schedule = DEFAULT_SCHEDULE) {
  const { start } = getQuincenaRange(today, schedule)
  // the day before this start belongs to the previous quincena
  return getQuincenaRange(
    new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1),
    schedule,
  )
}

// The same balance in whole cents (no rounding noise), for checks and
// reports. Savings moves are transfers: they are never income or expense.
export function savingsBalanceCents(moves, code) {
  let cents = 0
  for (const move of moves) {
    if (move.currency !== code) continue
    const amount = Math.round(move.amount * 100)
    cents += move.direction === 'in' ? amount : move.direction === 'out' ? -amount : 0
  }
  return cents
}

// True when taking `amount` out of savings in one currency leaves a balance
// of zero or more. A deposit is always allowed. Used before writing, so a
// withdrawal larger than the balance never reaches the database.
export function canWithdraw(moves, code, amount) {
  return Math.round(amount * 100) <= savingsBalanceCents(moves, code)
}
