import {
  MAX_CATEGORY_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_PROFILE_NAME_LENGTH,
} from './limits'
import { currencies, isWholeForCurrency, parseAmount, sum } from './money'
import {
  DEFAULT_SCHEDULE,
  changeSchedule,
  normalizeSchedule,
  registerPayday,
} from './quincenaSchedule'

// Pure rules of the first-use screen: no database, no clock, no React.

// the built-in "Bills" category (see db/mockData.js)
export const BILLS_CATEGORY_ID = 3
// the "New category..." choice of the category selector
export const NEW_CATEGORY = 'new'

// The name as it is saved: no stray spaces, cut to what the field allows
export function cleanName(text) {
  return typeof text === 'string'
    ? text.replace(/\s+/g, ' ').trim().slice(0, MAX_PROFILE_NAME_LENGTH).trim()
    : ''
}

export function cleanCurrency(code) {
  return currencies.some((c) => c.code === code) ? code : 'CRC'
}

// True once the welcome was done (or skipped); a profile without the date
// has not seen it
export function isOnboarded(profile) {
  return typeof profile?.onboardedAt === 'string' && profile.onboardedAt !== ''
}

// An optional amount typed in a step: '' (or 0) is "nothing" (null), a valid
// amount is a number, anything else is invalid (undefined) so the step can
// warn about it. With a currency, cents in colones are invalid too.
export function optionalAmount(text, currency) {
  const amount = parseAmount(text)
  if (amount === null) return undefined
  if (currency && !isWholeForCurrency(amount, currency)) return undefined
  return amount > 0 ? amount : null
}

// How many pay days a month the person has: 15/30 and two pay days are 2,
// a single pay day a month is 1
export function quincenasPerMonth(choice) {
  if (!choice || choice.mode !== 'paydays') return 2
  const { day1, day2 } = choice
  return day2 && day2 !== day1 ? 2 : 1
}

// What is left free in a quincena, on average, once the fixed expenses and
// the savings goal are taken out of one pay.
//   expenses: [{ amount, schedule }]  'every' is paid each quincena; 'first'
//   and 'second' are monthly, so they weigh 1/perMonth of their amount in an
//   average quincena. Everything is in the profile's main currency.
// Returns { income, fixed, goal, free } rounded to cents; free may be negative.
export function freePerQuincena({
  income = 0,
  expenses = [],
  savingsGoal = 0,
  perMonth = 2,
}) {
  const everyQuincena = sum(
    expenses.filter((e) => e.schedule === 'every').map((e) => e.amount),
  )
  const monthly = sum(
    expenses.filter((e) => e.schedule !== 'every').map((e) => e.amount),
  )
  // a pay-day count that is not a positive number reads as one a month
  const divisor = perMonth >= 1 ? perMonth : 1
  const fixed = sum([everyQuincena, monthly / divisor])
  const goal = savingsGoal || 0
  return { income, fixed, goal, free: sum([income, -fixed, -goal]) }
}

// The schedule to save after the pay days step. On a really new install
// (nothing registered) the choice is in force from the start, because there
// is no past to protect; with data it goes through changeSchedule, so the
// quincenas already lived are never moved.
// A manual choice ({ mode: 'manual', from }) starts a quincena on the day the
// person was paid: with data it goes through registerPayday (a date that would
// move the past leaves the schedule as it is); with none, the old 15/30 stays
// before that day.
export function scheduleForOnboarding(current, choice, today, hasData) {
  if (choice.mode === 'manual') {
    if (hasData) {
      const result = registerPayday(current, choice.from, today)
      return result.ok ? result.schedule : normalizeSchedule(current)
    }
    return normalizeSchedule([DEFAULT_SCHEDULE[0], { from: choice.from, mode: 'manual' }])
  }
  if (hasData) return changeSchedule(current, choice, today)
  return normalizeSchedule([{ ...choice, from: '2000-01-01' }])
}

// A fixed expense typed in the list. Returns { ok: true, item } with the
// recurring item ready to save, or { ok: false, reason } where reason is
// 'name' (empty), 'amount' (missing or invalid), 'wholeColones' (cents in
// colones) or 'category' (a new
// category was chosen without a name).
// categoryId is an existing category id, or NEW_CATEGORY with the name in
// newCategoryName: the item then carries `newCategory` (the name) instead of
// a categoryId, and saving it creates the category (see completeOnboarding).
export function buildFixedExpense({
  name,
  amountText,
  schedule = 'every',
  currency = 'CRC',
  categoryId = BILLS_CATEGORY_ID,
  newCategoryName = '',
}) {
  const note =
    typeof name === 'string' ? name.trim().slice(0, MAX_NOTE_LENGTH) : ''
  if (note === '') return { ok: false, reason: 'name' }
  const amount = parseAmount(amountText)
  if (amount === null || amount <= 0) return { ok: false, reason: 'amount' }
  const cleanCode = cleanCurrency(currency)
  if (!isWholeForCurrency(amount, cleanCode)) {
    return { ok: false, reason: 'wholeColones' }
  }
  const base = {
    amount,
    currency: cleanCode,
    type: 'expense',
    note,
    schedule,
  }
  if (categoryId !== NEW_CATEGORY) {
    return { ok: true, item: { ...base, categoryId } }
  }
  const newCategory =
    typeof newCategoryName === 'string'
      ? newCategoryName
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, MAX_CATEGORY_NAME_LENGTH)
          .trim()
      : ''
  if (newCategory === '') return { ok: false, reason: 'category' }
  return { ok: true, item: { ...base, categoryId: null, newCategory } }
}

// The recurring income created from "how much do you earn per pay"
export function buildIncomeItem(amount, currency, note) {
  return {
    amount,
    currency: cleanCurrency(currency),
    type: 'income',
    categoryId: null,
    note,
    schedule: 'every',
  }
}

// The profile of a person who has not done the welcome yet (and what "clear
// all data" goes back to)
export const EMPTY_PROFILE = {
  name: '',
  income: null,
  currency: 'CRC',
  savingsGoal: null,
  onboardedAt: null,
}

// What to do with the recurring income when the welcome is done again.
//   income: the amount typed now (null = left empty)
//   previous: { income, currency } saved in the profile before
//   recurring: the current recurring items
// Returns { action: 'none' } (nothing typed, or nothing changed),
// { action: 'update', id, item } (the income the welcome created before is
// found and changed) or { action: 'add', item }. Never duplicates an income.
export function planIncome({ income, currency, note, previous, recurring }) {
  if (!(income > 0)) return { action: 'none' }
  const item = buildIncomeItem(income, currency, note)
  const old = previous?.income
    ? recurring.find(
        (r) =>
          r.type === 'income' &&
          r.schedule === 'every' &&
          r.amount === previous.income &&
          r.currency === previous.currency,
      )
    : null
  if (!old) {
    // same income already in the list (typed again by hand): leave it alone
    const same = recurring.some(
      (r) =>
        r.type === 'income' &&
        r.schedule === 'every' &&
        r.amount === item.amount &&
        r.currency === item.currency,
    )
    return same ? { action: 'none' } : { action: 'add', item }
  }
  if (old.amount === item.amount && old.currency === item.currency) {
    return { action: 'none' }
  }
  return {
    action: 'update',
    id: old.id,
    item: { ...item, note: old.note, lastPeriod: old.lastPeriod },
  }
}
