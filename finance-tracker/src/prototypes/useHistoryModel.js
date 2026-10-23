import { useState } from 'react'
import { useTransactions } from '../context/useTransactions'
import { useSettings } from '../context/useSettings'
import { byNewest, isSameMonth, parseDate } from '../lib/dates'
import { currencies, getTotals } from '../lib/money'
import { filterTransactions } from '../lib/search'

// Month and type filter of the two History prototypes. The type filter uses
// the same filterTransactions as the real History, but only inside the month
// on screen (the real one searches every month when a filter is active).
export function useHistoryModel() {
  const { locale, t } = useSettings()
  const { transactions, categories } = useTransactions()
  const today = new Date()
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [type, setType] = useState('all')

  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const canGoNext =
    nextMonth <= today || transactions.some((tx) => parseDate(tx.date) >= nextMonth)
  const changeMonth = (step) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + step, 1))

  const inMonth = transactions.filter((tx) => isSameMonth(parseDate(tx.date), month))
  const list = filterTransactions(
    inMonth,
    { query: '', type, categoryId: 'all', method: 'all' },
    categories,
    t,
  ).sort(byNewest)

  // one group per day, newest first, with the day's totals per currency
  const days = []
  for (const tx of list) {
    const last = days[days.length - 1]
    if (last && last.date === tx.date) last.items.push(tx)
    else days.push({ date: tx.date, items: [tx] })
  }
  const daysWithTotals = days.map((day) => ({
    ...day,
    totals: currencies
      .map((c) => ({ ...c, ...getTotals(day.items, c.code) }))
      .filter((c) => c.count > 0),
  }))

  const summaries = currencies
    .map((c) => ({ ...c, ...getTotals(list, c.code) }))
    .filter((c) => c.count > 0)

  return {
    locale,
    t,
    today,
    categories,
    transactions,
    month,
    canGoNext,
    changeMonth,
    type,
    setType,
    list,
    days: daysWithTotals,
    summaries,
  }
}
