import { MAX_AMOUNT, formatMoney, parseAmount } from './money'
import { isValidDate, todayString } from './dates'
import { savingsYear } from './savingsReport'

// Pure decisions behind the Savings screen and the piggy bank: what level the
// piggy shows, which goal a bar belongs to, what happens (and what is said)
// after a savings move was saved, and how a typed amount is judged. No React
// and no clock in here, so all of it is easy to test.

// How full the piggy looks when there is no goal to measure against, and the
// least it shows once something is saved (a sliver would look empty)
export const DEFAULT_FILL = 0.3
export const MIN_FILL = 0.06

const toCents = (amount) => Math.round(amount * 100)

// The goal the piggy is filling towards: of the unreached goals of one
// currency, the nearest one (smallest target; the older one on a tie).
// null when there is none.
export function nextGoal(goals, currency) {
  const open = goals.filter((goal) => goal.currency === currency && !goal.achievedAt)
  if (open.length === 0) return null
  return [...open].sort((a, b) => a.target - b.target || a.id - b.id)[0]
}

// True when the currency has goals and every one of them was reached
export function allGoalsReached(goals, currency) {
  const own = goals.filter((goal) => goal.currency === currency)
  return own.length > 0 && own.every((goal) => Boolean(goal.achievedAt))
}

// How far a goal is, for a progress bar and its percentage. A goal that was
// reached once stays at 100% even if the balance later drops (achievedAt is
// never cleared). `percent` is a whole number and only 100 when really done.
export function goalProgress(goal, balance) {
  const target = toCents(goal.target)
  const ratio = goal.achievedAt
    ? 1
    : target > 0
      ? Math.min(1, Math.max(0, toCents(balance) / target))
      : 0
  return { ratio, percent: ratio >= 1 ? 100 : Math.floor(ratio * 100) }
}

// The level of the piggy's belly, 0..1: empty with nothing saved; the progress
// towards the next goal when there is one; a gentle default otherwise
// When every goal of the currency is reached there is nothing left to measure
// against and the piggy shows full (allReached, see allGoalsReached).
export function pigFill(balance, goal, allReached = false) {
  if (!(balance > 0)) return 0
  if (!goal) return allReached ? 1 : DEFAULT_FILL
  return Math.max(MIN_FILL, goalProgress(goal, balance).ratio)
}

// What follows a saved savings move. Everything expressive is decided HERE and
// only from the answer of that one write, never from the data on screen, so a
// reload (which has no answer to look at) can never celebrate again.
//   status 'pending'                   nothing moves; a neutral message
//   status 'confirmed', direction out  the coin leaves; a neutral message
//   status 'confirmed', in             the coin drops in
//   ... and goals newly reached        the milestone (hop + burst)
export function moveOutcome({ direction, status, achievedGoalIds = [] }) {
  if (status !== 'confirmed') return { animation: null, message: 'pending', celebrate: false }
  if (direction === 'out') return { animation: 'withdraw', message: 'withdraw', celebrate: false }
  if (achievedGoalIds.length > 0) return { animation: 'deposit', message: 'goal', celebrate: true }
  return { animation: 'deposit', message: 'deposit', celebrate: false }
}

// The goals a write reached, as the objects the screen knows
export function reachedGoals(achievedGoalIds, goals) {
  return achievedGoalIds.map((id) => goals.find((goal) => goal.id === id)).filter(Boolean)
}

// "Hello {name}" with its {placeholders} filled in
export function fillTemplate(text, values) {
  return text.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole))
}

// True when the text reads as an amount in the Costa Rican way but is above
// the limit (parseAmount answers null for that, like for any invalid text)
function isAboveMax(text) {
  const trimmed = text.trim()
  let normalized = null
  if (/^\d+$/.test(trimmed)) normalized = trimmed
  else if (/^[1-9]\d{0,2}(\.\d{3})+(,\d{1,2})?$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+[.,]\d{1,2}$/.test(trimmed)) normalized = trimmed.replace(',', '.')
  return normalized !== null && Number(normalized) > MAX_AMOUNT
}

// What is wrong with a typed amount of a savings move, or null:
//   'empty'        nothing typed          'zero'          zero
//   'invalid'      not an amount          'tooBig'        above MAX_AMOUNT
//   'aboveBalance' a withdrawal larger than the balance of that currency
//   'wholeColones' céntimos in colones (colones are whole units in the app)
export function amountProblem(text, { direction, balance, currency }) {
  if (text.trim() === '') return 'empty'
  const amount = parseAmount(text)
  if (amount === null) return isAboveMax(text) ? 'tooBig' : 'invalid'
  if (amount === 0) return 'zero'
  if (currency === 'CRC' && toCents(amount) % 100 !== 0) return 'wholeColones'
  if (direction === 'out' && toCents(amount) > toCents(balance)) return 'aboveBalance'
  return null
}

// The text under the amount field for a problem found by amountProblem
export function amountMessage(t, problem, { currency, balance }) {
  switch (problem) {
    case 'empty':
      return t('svAmountEmpty')
    case 'zero':
      return t('svAmountZero')
    case 'invalid':
      return t('invalidAmount')
    case 'tooBig':
      return fillTemplate(t('svAmountTooBig'), { max: formatMoney(MAX_AMOUNT, currency) })
    case 'wholeColones':
      return t('svAmountWholeColones')
    case 'aboveBalance':
      return `${t('notEnoughSavings')} ${formatMoney(balance, currency)}`
    default:
      return null
  }
}

// What is wrong with the date of a move, or null (no future days)
export function dateProblem(date, today = new Date()) {
  if (!isValidDate(date)) return 'invalid'
  return date > todayString(today) ? 'future' : null
}

// Widths of two bars that are compared with each other, 0..1: the larger one
// is the full bar. Two zeros give two empty bars.
export function barRatios(a, b) {
  const top = Math.max(a, b, 0)
  if (top <= 0) return [0, 0]
  return [Math.max(0, a) / top, Math.max(0, b) / top]
}

// The years in which one currency had savings activity, newest first, with
// their numbers: the comparison row per year of the yearly report
export function yearsWithSavings(savings, years, currency) {
  return years
    .map((year) => ({ year, ...savingsYear(savings, year, currency) }))
    .filter((row) => row.deposits > 0 || row.withdrawals > 0)
}
