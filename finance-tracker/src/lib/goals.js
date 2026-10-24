import { isValidDate, todayString } from './dates'
import { MAX_GOAL_NAME_LENGTH } from './limits'
import { currencies, isValidAmount } from './money'
import { canWithdraw, savingsBalanceCents } from './savings'

const currencyCodes = currencies.map((c) => c.code)

const toCents = (amount) => Math.round(amount * 100)

// A savings goal, as the app sees it:
//   { id, name, target, currency, createdAt, achievedAt }
// target is a decimal amount (cents in the databases), createdAt and
// achievedAt are YYYY-MM-DD (achievedAt null until reached).

// The goal as it will be saved, or an error: the name is trimmed and cut to
// MAX_GOAL_NAME_LENGTH (and must not be empty), the target must be a valid
// amount, the currency known. Dates that are missing or invalid read as
// today (createdAt) and null (achievedAt). An id is kept only if given.
export function normalizeGoal(goal, today = todayString()) {
  const name =
    typeof goal?.name === 'string'
      ? goal.name.trim().slice(0, MAX_GOAL_NAME_LENGTH).trim()
      : ''
  if (name === '') throw new Error('Invalid goal name')
  if (!isValidAmount(goal.target)) throw new Error(`Invalid goal target: ${goal.target}`)
  if (!currencyCodes.includes(goal.currency)) {
    throw new Error(`Invalid goal currency: ${goal.currency}`)
  }
  const clean = {
    name,
    target: Math.round(goal.target * 100) / 100,
    currency: goal.currency,
    createdAt:
      typeof goal.createdAt === 'string' && isValidDate(goal.createdAt)
        ? goal.createdAt
        : today,
    achievedAt:
      typeof goal.achievedAt === 'string' && isValidDate(goal.achievedAt)
        ? goal.achievedAt
        : null,
  }
  return goal.id === undefined || goal.id === null ? clean : { id: goal.id, ...clean }
}

// The goals of one currency whose target is met by the current savings
// balance of that currency and that have not been celebrated yet
// (achievedAt null). Goals do not reserve money: two goals can both be met by
// the same balance.
//
// A withdrawal that takes the balance below a target does NOT clear
// achievedAt: a goal reached once stays reached, so a refresh or a later
// deposit never celebrates it twice.
export function goalsReached(goals, savings, currency) {
  const balance = savingsBalanceCents(savings, currency)
  return goals.filter(
    (goal) =>
      goal.currency === currency &&
      !goal.achievedAt &&
      balance >= toCents(goal.target),
  )
}

// What to check before saving a savings move, from the current state:
//   { ok: false, code: 'insufficientSavings' }  a withdrawal larger than the
//                                               balance of its currency
//   { ok: true, achieveGoalIds }                the goals a deposit reaches
//                                               (empty for a withdrawal)
// A move with the id of one already saved (a retry of the same action) does
// not count that earlier try twice.
export function planSavingsMove(move, savings, goals) {
  const others =
    move.id === undefined || move.id === null
      ? savings
      : savings.filter((item) => item.id !== move.id)
  if (move.direction === 'out') {
    return canWithdraw(others, move.currency, move.amount)
      ? { ok: true, achieveGoalIds: [] }
      : { ok: false, code: 'insufficientSavings' }
  }
  return {
    ok: true,
    achieveGoalIds: goalsReached(goals, [...others, move], move.currency).map(
      (goal) => goal.id,
    ),
  }
}
