import { useEffect, useState } from 'react'
import { useTransactions } from '../context/useTransactions'
import { useSettings } from '../context/useSettings'
import { useDialog } from '../context/useDialog'
import {
  byNewest,
  daysBetween,
  daysLeftInQuincena,
  getQuincenaRange,
  parseDate,
  quincenaKey,
  todayString,
} from '../lib/dates'
import { useToday } from '../lib/useToday'
import { currencies, formatMoney } from '../lib/money'
import { readPref, writePref } from '../lib/prefs'
import { quincenaFigures, rolloverLeftover } from '../lib/quincena'
import { manualState } from '../lib/quincenaSchedule'
import { isDue, isHandled } from '../lib/recurring'
import {
  ROLLOVER_NOTE,
  previousQuincenaRange,
  rolloverSkipKey,
  savingsBalance,
} from '../lib/savings'
import { getCategoryTotals } from '../lib/stats'
import { copy } from './copy'

// Everything the two Home prototypes show. The calculations are copied from
// features/expenses/HomeScreen.jsx (same lib functions, same order) so the
// numbers match the real Home exactly.
export function useHomeModel() {
  const { locale, t } = useSettings()
  const { alert } = useDialog()
  const today = useToday()
  const {
    quincenaSchedule,
    transactions,
    categories,
    budgets,
    recurring,
    savings,
    profile,
    confirmRecurring,
    skipRecurring,
    addSavingsMove,
  } = useTransactions()

  const { start, end } = getQuincenaRange(today, quincenaSchedule)
  const daysLeft = daysLeftInQuincena(today, quincenaSchedule)
  const manual = manualState(quincenaSchedule, today)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [skipped, setSkipped] = useState(() =>
    Object.fromEntries(currencies.map((c) => [c.code, readPref(rolloverSkipKey(c.code))])),
  )

  // the reassuring message fades away by itself
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const current = transactions.filter((tx) => {
    const date = parseDate(tx.date)
    return date >= start && date <= end
  })
  const recent = [...transactions].sort(byNewest).slice(0, 5)

  const todayText = todayString(today)
  const yesterdayText = todayString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
  )
  const todayList = transactions.filter((tx) => tx.date === todayText).sort(byNewest)
  const yesterdayList = transactions
    .filter((tx) => tx.date === yesterdayText)
    .sort(byNewest)

  const due = recurring.filter((item) => isDue(item, today, quincenaSchedule))
  const handled = recurring.filter((item) => isHandled(item, today, quincenaSchedule))

  const previous = previousQuincenaRange(today, quincenaSchedule)
  const previousKey = quincenaKey(previous.start, quincenaSchedule)
  const offers = currencies
    .map(({ code }) => ({
      code,
      leftover: rolloverLeftover({ transactions, savings, quincenaSchedule }, code, today),
    }))
    .filter(({ code, leftover }) => leftover > 0 && skipped[code] !== previousKey)

  // one action at a time; a failed write is reported, not swallowed
  const run = async (action, message) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
      setNotice(message)
    } catch (error) {
      console.error(error)
      await alert(copy.saveError)
    } finally {
      setBusy(false)
    }
  }

  const confirmDue = (item) => run(() => confirmRecurring(item), copy.savedNotice)
  const skipDue = (item) => run(() => skipRecurring(item), copy.skippedNotice)
  const moveLeftover = (code, leftover) =>
    run(
      () =>
        addSavingsMove({
          amount: leftover,
          currency: code,
          direction: 'in',
          note: ROLLOVER_NOTE,
          date: todayString(previous.end),
        }),
      copy.moveNotice,
    )
  const skipLeftover = (code) =>
    run(async () => {
      writePref(rolloverSkipKey(code), previousKey)
      setSkipped((prev) => ({ ...prev, [code]: previousKey }))
    }, copy.leftoverNotNowNotice)

  // a currency is shown when it has movements, pending bills or savings moves
  const shown = currencies
    .map((c) => {
      const figures = quincenaFigures(
        { transactions, savings, recurring, quincenaSchedule, profile },
        c.code,
        today,
      )
      const expenses = current.filter(
        (tx) => tx.currency === c.code && tx.type === 'expense',
      )
      return {
        ...c,
        ...figures,
        categoryTotals: getCategoryTotals(expenses, categories),
        budgets: budgets.filter((b) => b.currency === c.code),
        hasBase: figures.income > 0 || figures.fromSavings > 0,
      }
    })
    .filter((c) => c.count > 0 || c.pending > 0 || c.toSavings > 0 || c.fromSavings > 0)

  const balancesText =
    currencies
      .map(({ code }) => ({ code, balance: savingsBalance(savings, code) }))
      .filter(({ balance }) => balance !== 0)
      .map(({ code, balance }) => formatMoney(balance, code))
      .join(' · ') || formatMoney(0, 'CRC')

  const totalDays = daysBetween(start, end) + 1
  // a late manual quincena has no known end: shown as its last day
  const dayNumber = manual.overdue ? totalDays : totalDays - daysLeft + 1

  return {
    locale,
    t,
    today,
    profile,
    categories,
    transactions,
    savings,
    due,
    handled,
    offers,
    shown,
    recent,
    todayList,
    yesterdayList,
    balancesText,
    totalDays,
    dayNumber,
    daysLeft,
    manual,
    busy,
    notice,
    confirmDue,
    skipDue,
    moveLeftover,
    skipLeftover,
  }
}
