import { daysLeftInQuincena, getQuincenaRange, parseDate, todayString } from './dates'
import { getTotals, laterTotal, safePerDay, sum } from './money'
import { pendingTotal } from './recurring'
import { DEFAULT_SCHEDULE, isOpenManual } from './quincenaSchedule'
import { leftInRange, previousQuincenaRange, savingsInRange } from './savings'

// Everything Home needs to know about one currency in the current quincena.
//
// Rule for "safe to spend per day" (case L2): only money that is already in
// hand counts. An income dated AFTER today (inside this quincena) is shown
// in the totals, but it is taken out of what can be spent per day until its
// date arrives. Bills still pending (recurring items due) are taken out too.
//
// Savings goal (case L5): the goal of the profile is per quincena and in one
// currency. What is still missing of it (the goal minus what was already moved
// to savings in this quincena) is set aside BEFORE dividing by the days, so the
// daily amount is the recommended one and the goal is not left for the end.
// The reserve never exceeds what is available. perDayFull is the daily amount
// without any goal, so the screen can show both.
//
// status says what to show instead of a number when there is nothing to
// spend: 'ok' | 'pendingExceeds' | 'waitingIncome' | 'over'.
export function quincenaFigures(
  {
    transactions,
    savings,
    recurring,
    quincenaSchedule = DEFAULT_SCHEDULE,
    profile = null,
  },
  code,
  today = new Date(),
) {
  const { start, end } = getQuincenaRange(today, quincenaSchedule)
  const inRange = transactions.filter((tx) => {
    const date = parseDate(tx.date)
    return date >= start && date <= end
  })
  const totals = getTotals(inRange, code)
  const { toSavings, fromSavings } = savingsInRange(savings, code, start, end)
  const left = sum([totals.net, -toSavings, fromSavings])
  const pending = pendingTotal(recurring, code, today, quincenaSchedule)
  const later = laterTotal(inRange, code, today)
  const laterIncome = laterTotal(inRange, code, today, 'income')
  // what is really in hand today, before the bills that are still due
  const inHand = sum([left, -laterIncome])
  const available = sum([inHand, -pending])
  const days = daysLeftInQuincena(today, quincenaSchedule)

  // the goal only applies to the currency it was set in
  const goal =
    profile?.savingsGoal > 0 && profile.currency === code ? profile.savingsGoal : 0
  const reserve = Math.min(Math.max(sum([goal, -toSavings]), 0), Math.max(available, 0))

  let status = 'ok'
  if (available <= 0) {
    if (inHand > 0) status = 'pendingExceeds'
    else if (left > 0) status = 'waitingIncome'
    else status = 'over'
  }

  return {
    ...totals,
    toSavings,
    fromSavings,
    left,
    pending,
    later,
    laterIncome,
    inHand,
    available,
    days,
    status,
    goal,
    reserve,
    perDayFull: status === 'ok' ? safePerDay(available, days, code) : 0,
    perDay: status === 'ok' ? safePerDay(sum([available, -reserve]), days, code) : 0,
  }
}

// What the previous quincena left over in one currency, to offer it for
// savings (case L1).
//
// Rule: an income dated on the LAST DAY of the closing quincena (in 15/30, the
// 15th or the last day of the month) is not counted. In Costa Rica the pay of
// the 15th and of the 30th is usually meant to cover the quincena that is
// starting, so counting it would offer the new quincena's money as a leftover
// of the old one. The offer can therefore be smaller than the "real"
// leftover, but it never promises money that is still needed. The person can
// date that income on the 16th (or the 1st) so it counts in the new quincena.
export function rolloverLeftover(
  { transactions, savings, quincenaSchedule = DEFAULT_SCHEDULE },
  code,
  today = new Date(),
) {
  const previous = previousQuincenaRange(today, quincenaSchedule)
  const closingDay = todayString(previous.end)
  const leftover = leftInRange(
    transactions,
    savings,
    code,
    previous.start,
    previous.end,
  )
  const closingIncome = sum(
    transactions
      .filter(
        (tx) =>
          tx.type === 'income' && tx.currency === code && tx.date === closingDay,
      )
      .map((tx) => tx.amount),
  )
  return sum([leftover, -closingIncome])
}

// True when a date is the last day of its quincena (in 15/30, the 15th or
// month end)
export function isClosingDay(dateText, schedule = DEFAULT_SCHEDULE) {
  if (typeof dateText !== 'string') return false
  const date = parseDate(dateText)
  if (Number.isNaN(date.getTime())) return false
  // a manual quincena with no next payment registered has no known last day
  if (isOpenManual(schedule, date)) return false
  return todayString(getQuincenaRange(date, schedule).end) === dateText
}

// The first day of the next quincena after a date (in 15/30, the 16th or the 1st)
export function nextQuincenaStart(dateText, schedule = DEFAULT_SCHEDULE) {
  const end = getQuincenaRange(parseDate(dateText), schedule).end
  return todayString(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1))
}

// How much can still be moved to savings now: what is in hand (income dated
// after today is not), and never below zero (case L4)
export function availableForSavings(figures) {
  return Math.max(figures.inHand, 0)
}
