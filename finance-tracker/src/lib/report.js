import { categoryLabel, uncategorized } from './categories'
import { byNewest, parseDate } from './dates'
import { currencies, getTotals } from './money'
import { paymentLabel } from './payment'
import { savingsInRange } from './savings'
import { getCategoryTotals } from './stats'

// What the printable report shows. Pure: it only arranges the numbers the
// other helpers already give (getTotals, savingsInRange, getCategoryTotals);
// nothing here adds money, and a currency is never added to another.
//
// scope:
//   { kind: 'all' }                          every month, newest first
//   { kind: 'month', year, month }           one month (month is 0-11, like Date)
//   { kind: 'list', ids }                    the transactions with those ids
//                                            (a filtered History), in one section
//
// Returns { sections }, one section per month (newest first), or a single
// section for a month or a list. A section is
//   { key, year, month, totals, categories, days }
//   totals:     [{ code, income, spent, savedIn, savedOut }]  only currencies
//               with data in the section
//   categories: [{ code, spent, rows: [{ category, label, amount, share }] }]
//               spending per category, biggest first; share is the percentage
//               (0-100, one decimal) of that currency's spending
//   days:       [{ date, items: [{ id, date, description, categoryLabel,
//               paymentLabel, type, amount, currency }] }]  newest first;
//               amount is signed: expenses negative, income positive
// Savings moves count in the totals of 'all' and 'month' only; a list of
// results has no savings.
export function buildReport({ transactions, savings = [], categories, scope = { kind: 'all' }, t }) {
  let txs = transactions
  let moves = savings
  if (scope.kind === 'month') {
    const inMonth = (value) => {
      const date = parseDate(value)
      return date.getFullYear() === scope.year && date.getMonth() === scope.month
    }
    txs = transactions.filter((tx) => inMonth(tx.date))
    moves = savings.filter((move) => inMonth(move.date))
  } else if (scope.kind === 'list') {
    const ids = new Set(scope.ids ?? [])
    txs = transactions.filter((tx) => ids.has(tx.id))
    moves = []
  }

  // group by 'YYYY-MM' (one group for a list)
  const groups = new Map()
  const groupOf = (dateText) => (scope.kind === 'list' ? 'list' : dateText.slice(0, 7))
  const slot = (key) => {
    if (!groups.has(key)) groups.set(key, { txs: [], moves: [] })
    return groups.get(key)
  }
  for (const tx of txs) slot(groupOf(tx.date)).txs.push(tx)
  for (const move of moves) slot(groupOf(move.date)).moves.push(move)

  const keys = [...groups.keys()].sort().reverse()
  const sections = keys.map((key) => {
    const group = groups.get(key)
    const first = key === 'list' ? null : parseDate(`${key}-01`)
    const start = first
    const end = first ? new Date(first.getFullYear(), first.getMonth() + 1, 0) : null

    const totals = []
    const byCategory = []
    for (const { code } of currencies) {
      const { count, income, spent } = getTotals(group.txs, code)
      const { toSavings: savedIn, fromSavings: savedOut } = start
        ? savingsInRange(group.moves, code, start, end)
        : { toSavings: 0, fromSavings: 0 }
      const hasMoves = group.moves.some((move) => move.currency === code)
      if (count === 0 && !hasMoves) continue
      totals.push({ code, income, spent, savedIn, savedOut })

      const expenses = group.txs.filter((tx) => tx.type === 'expense' && tx.currency === code)
      const rows = getCategoryTotals(expenses, categories)
        .map(({ category, total }) => ({
          category,
          label: categoryLabel(category, t),
          amount: total,
          share: spent > 0 ? Math.round((total / spent) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
      if (rows.length > 0) byCategory.push({ code, spent, rows })
    }

    const days = []
    for (const tx of [...group.txs].sort(byNewest)) {
      const category = categories.find((c) => c.id === tx.categoryId)
      // income has no category of its own: it says so, like History does
      const categoryName =
        !category && tx.type === 'income'
          ? t('typeIncome')
          : categoryLabel(category ?? uncategorized, t)
      const item = {
        id: tx.id,
        date: tx.date,
        description: tx.note || categoryName,
        categoryLabel: categoryName,
        paymentLabel: paymentLabel(tx.paymentMethod, t),
        type: tx.type,
        amount: tx.type === 'income' ? tx.amount : -tx.amount,
        currency: tx.currency,
      }
      const last = days[days.length - 1]
      if (last && last.date === tx.date) last.items.push(item)
      else days.push({ date: tx.date, items: [item] })
    }

    return {
      key,
      year: first ? first.getFullYear() : null,
      month: first ? first.getMonth() : null,
      totals,
      categories: byCategory,
      days,
    }
  })

  return { sections }
}
