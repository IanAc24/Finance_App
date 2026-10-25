import { MAX_YEAR, MIN_YEAR, isValidDate } from './dates'
import { currencies } from './money'

// Yearly numbers for savings and income. Everything is added in whole cents
// and shown as decimals; currencies are never mixed. Dates are YYYY-MM-DD
// strings, which compare correctly as text.

// The year of a /savings/recap/:year address, or null when it is not four
// digits or falls outside MIN_YEAR to MAX_YEAR (the screen then goes back)
export function yearFromParam(text) {
  if (!/^\d{4}$/.test(text ?? '')) return null
  const year = Number(text)
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : null
}

const toCents = (amount) => Math.round(amount * 100)
const yearOf = (date) => Number(String(date).slice(0, 4))

// Savings in one currency for a calendar year:
//   opening      balance of every move before Jan 1 (never reset by a year)
//   deposits     moved in during the year
//   withdrawals  taken out during the year
//   closing      opening + deposits - withdrawals
export function savingsYear(savings, year, currency) {
  let opening = 0
  let deposits = 0
  let withdrawals = 0
  for (const move of savings) {
    if (move.currency !== currency || !isValidDate(move.date)) continue
    const cents = toCents(move.amount)
    const signed = move.direction === 'in' ? cents : -cents
    const moveYear = yearOf(move.date)
    if (moveYear < year) opening += signed
    else if (moveYear === year) {
      if (move.direction === 'in') deposits += cents
      else withdrawals += cents
    }
  }
  return {
    opening: opening / 100,
    deposits: deposits / 100,
    withdrawals: withdrawals / 100,
    closing: (opening + deposits - withdrawals) / 100,
  }
}

// Income minus expenses of one currency between two days (both included).
// It is what was left over, not what was saved.
export function periodSurplus(transactions, from, to, currency) {
  let cents = 0
  for (const tx of transactions) {
    if (tx.currency !== currency || tx.date < from || tx.date > to) continue
    cents += tx.type === 'income' ? toCents(tx.amount) : -toCents(tx.amount)
  }
  return cents / 100
}

// The years with any data (a transaction, a savings move or a goal reached),
// newest first
export function availableYears(transactions, savings, goals = []) {
  const years = new Set()
  for (const item of [...transactions, ...savings]) {
    if (isValidDate(item.date)) years.add(yearOf(item.date))
  }
  for (const goal of goals) {
    if (goal.achievedAt && isValidDate(goal.achievedAt)) years.add(yearOf(goal.achievedAt))
  }
  return [...years].sort((a, b) => b - a)
}

// What a year looked like, per currency:
//   { CRC: {...}, USD: {...} } with
//   income, expenses, surplus (income - expenses: NOT savings),
//   deposits, withdrawals, opening, closing (see savingsYear),
//   goalsAchieved (the goals reached during the year, in that currency),
//   incomplete + reason.
// incomplete is true when the numbers cannot be trusted as a full picture:
//   reason 'noData'              nothing in the year and no balance carried over
//   reason 'historyAfterSavings' savings moves exist before the first
//                                transaction of that currency, so the
//                                history of spending starts after the savings
// Every figure that exists is still returned; the UI shows them and adds a
// caution for 'historyAfterSavings' (the surplus of earlier years may be short).
export function yearRecap(transactions, savings, goals, year) {
  const result = {}
  for (const { code } of currencies) {
    const own = transactions.filter((tx) => tx.currency === code)
    const inYear = own.filter((tx) => isValidDate(tx.date) && yearOf(tx.date) === year)
    let income = 0
    let expenses = 0
    for (const tx of inYear) {
      if (tx.type === 'income') income += toCents(tx.amount)
      else expenses += toCents(tx.amount)
    }
    const saved = savingsYear(savings, year, code)
    const moves = savings.filter((move) => move.currency === code && isValidDate(move.date))
    const movesInYear = moves.filter((move) => yearOf(move.date) === year)

    const firstTransaction = own
      .filter((tx) => isValidDate(tx.date))
      .reduce((first, tx) => (first === null || tx.date < first ? tx.date : first), null)
    const savedBeforeHistory =
      firstTransaction !== null && moves.some((move) => move.date < firstTransaction)

    let reason = null
    // nothing happened AND nothing is carried over (a year without activity
    // but with a balance still shows opening = closing)
    if (inYear.length === 0 && movesInYear.length === 0 && saved.opening === 0 && saved.closing === 0) {
      reason = 'noData'
    }
    else if (savedBeforeHistory || (firstTransaction === null && moves.length > 0)) {
      reason = 'historyAfterSavings'
    }

    result[code] = {
      income: income / 100,
      expenses: expenses / 100,
      surplus: (income - expenses) / 100,
      ...saved,
      goalsAchieved: goals.filter(
        (goal) =>
          goal.currency === code &&
          goal.achievedAt &&
          isValidDate(goal.achievedAt) &&
          yearOf(goal.achievedAt) === year,
      ),
      incomplete: reason !== null,
      reason,
    }
  }
  return result
}
