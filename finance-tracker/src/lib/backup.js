import { categoryColors, cleanCategoryName, findCategoryByName } from './categories'
import { daysBetween, isValidDate, parseDate, todayString } from './dates'
import { sourceFor } from './income'
import { currencies, isValidAmount } from './money'
import { normalizePaymentMethod } from './payment'
import { DEFAULT_SCHEDULE, normalizeSchedule } from './quincenaSchedule'
import { schedules } from './recurring'
import {
  MAX_CATEGORY_NAME_LENGTH,
  MAX_GOAL_NAME_LENGTH,
  MAX_NOTE_LENGTH,
} from './limits'
import { cleanCurrency, cleanName } from './onboarding'

const currencyCodes = currencies.map((c) => c.code)
const types = ['income', 'expense']

// Everything the user has entered, as one JSON-friendly object.
// Built-in categories are not included: every install already has them.
export function buildBackup(
  {
    transactions,
    categories,
    budgets,
    recurring,
    savings = [],
    goals = [],
    quincenaSchedule = DEFAULT_SCHEDULE,
    profile,
  },
  now = new Date(),
) {
  return {
    app: 'quincena',
    version: 1,
    exportedAt: now.toISOString(),
    categories: categories
      .filter((c) => !c.key)
      .map(({ id, name, color }) => ({ id, name, color })),
    transactions,
    budgets,
    recurring,
    savings,
    goals,
    quincenaSchedule,
    // the day it was welcomed is not carried: a restore marks it done itself
    ...(profile && {
      profile: {
        name: profile.name,
        currency: profile.currency,
        income: profile.income,
        savingsGoal: profile.savingsGoal,
      },
    }),
  }
}

// The slice of the app's data that goes into a backup. One place picks the
// lists, so a screen cannot forget one (the Settings screen once left out
// the savings goals).
export function backupInput(data) {
  const {
    transactions,
    categories,
    budgets,
    recurring,
    savings,
    goals,
    quincenaSchedule,
    profile,
  } = data
  return {
    transactions,
    categories,
    budgets,
    recurring,
    savings,
    goals,
    quincenaSchedule,
    profile,
  }
}

// Limits that keep a damaged or hostile file from filling the device:
// the file, each text, the ids and the number of records. Ids made in the
// cloud are time based (lib/ids.js, about 1.8e15 today), so the cap is 8e15:
// below Number.MAX_SAFE_INTEGER with room for the next SQLite ids.
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
export const MAX_ID = 8_000_000_000_000_000
export const MAX_RECORDS = 200_000

// Ids are positive integers up to MAX_ID (0 is the "Uncategorized" stand-in)
function isValidId(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_ID
}

// Texts are cut by characters, not UTF-16 units, so an emoji at the limit is
// kept whole or dropped whole and never left as half a character
function cutChars(text, max) {
  return Array.from(text).slice(0, max).join('')
}

function charCount(text) {
  return Array.from(text).length
}

// Notes are cut to what the form allows
function cleanNote(value) {
  return typeof value === 'string' ? cutChars(value, MAX_NOTE_LENGTH).trim() : ''
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toCents(value) {
  return Math.round(value * 100) / 100
}

// Keeps the first record of each key
function keepFirst(items, keyOf) {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyOf(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cleanCategory(c, builtInIds) {
  if (!isObject(c)) return null
  if (!isValidId(c.id) || builtInIds.has(c.id)) return null
  if (typeof c.name !== 'string') return null
  const name = cutChars(cleanCategoryName(c.name), MAX_CATEGORY_NAME_LENGTH).trim()
  if (name === '') return null
  if (!categoryColors.includes(c.color)) return null
  return { id: c.id, name, color: c.color }
}

// Fields shared by transactions and recurring items; null when invalid
function cleanEntry(item, knownIds) {
  if (!isObject(item)) return null
  if (!isValidId(item.id)) return null
  if (!isValidAmount(item.amount)) return null
  if (!currencyCodes.includes(item.currency)) return null
  if (!types.includes(item.type)) return null
  return {
    id: item.id,
    amount: toCents(item.amount),
    currency: item.currency,
    type: item.type,
    categoryId:
      item.type === 'expense' && knownIds.has(item.categoryId)
        ? item.categoryId
        : null,
    note: cleanNote(item.note),
  }
}

function cleanTransaction(tx, knownIds) {
  const entry = cleanEntry(tx, knownIds)
  if (!entry || typeof tx.date !== 'string' || !isValidDate(tx.date)) return null
  return {
    ...entry,
    date: tx.date,
    paymentMethod: normalizePaymentMethod(tx.paymentMethod),
    // optional: older backups have none; an unknown value, or a source on an
    // expense, reads as none
    source: sourceFor(tx),
  }
}

// A quincena name (see quincenaKey): 'YYYY-MM-1' or 'YYYY-MM-2' with a real
// month, or the real date it started
function isValidPeriod(value) {
  if (typeof value !== 'string') return false
  const half = /^(\d{4})-(\d{2})-([12])$/.exec(value)
  if (half) return isValidDate(`${half[1]}-${half[2]}-01`)
  return isValidDate(value)
}

function cleanRecurring(item, knownIds) {
  const entry = cleanEntry(item, knownIds)
  if (!entry || !schedules.includes(item.schedule)) return null
  const validPeriod = isValidPeriod(item.lastPeriod)
  return {
    ...entry,
    schedule: item.schedule,
    lastPeriod: validPeriod ? item.lastPeriod : null,
  }
}

function cleanBudget(b, knownIds) {
  if (!isObject(b)) return null
  if (!knownIds.has(b.categoryId)) return null
  if (!currencyCodes.includes(b.currency)) return null
  if (!isValidAmount(b.amount)) return null
  return {
    categoryId: b.categoryId,
    currency: b.currency,
    amount: toCents(b.amount),
  }
}

function cleanSavingsMove(move) {
  if (!isObject(move)) return null
  if (!isValidId(move.id)) return null
  if (!isValidAmount(move.amount)) return null
  if (!currencyCodes.includes(move.currency)) return null
  if (move.direction !== 'in' && move.direction !== 'out') return null
  if (typeof move.date !== 'string' || !isValidDate(move.date)) return null
  return {
    id: move.id,
    amount: toCents(move.amount),
    currency: move.currency,
    direction: move.direction,
    note: cleanNote(move.note),
    date: move.date,
  }
}

// A savings goal; an optional list (older backups have none). The name is
// cut to MAX_GOAL_NAME_LENGTH; a goal without a valid target, currency or
// creation day is left out. achievedAt is kept only when it is a valid day.
function cleanGoal(goal) {
  if (!isObject(goal)) return null
  if (!isValidId(goal.id)) return null
  if (typeof goal.name !== 'string') return null
  const name = cutChars(goal.name.trim(), MAX_GOAL_NAME_LENGTH).trim()
  if (name === '') return null
  if (!isValidAmount(goal.target)) return null
  if (!currencyCodes.includes(goal.currency)) return null
  if (typeof goal.createdAt !== 'string' || !isValidDate(goal.createdAt)) return null
  return {
    id: goal.id,
    name,
    target: toCents(goal.target),
    currency: goal.currency,
    createdAt: goal.createdAt,
    achievedAt:
      typeof goal.achievedAt === 'string' && isValidDate(goal.achievedAt)
        ? goal.achievedAt
        : null,
  }
}

// The name, main currency, income and savings goal of a backup; null when
// the file has none (an older backup) or it is not an object
function cleanProfile(p) {
  if (!isObject(p)) return null
  const cleaned = {
    name: cleanName(p.name),
    currency: cleanCurrency(p.currency),
    income: isValidAmount(p.income) ? toCents(p.income) : null,
    savingsGoal: isValidAmount(p.savingsGoal) ? toCents(p.savingsGoal) : null,
  }
  // an empty profile would erase the name and income the person already has
  const empty =
    cleaned.name === '' && cleaned.income === null && cleaned.savingsGoal === null
  return empty ? null : cleaned
}

// Applies the cleaner to each record and drops the ones it rejects
function clean(list, cleaner) {
  return list.map(cleaner).filter((item) => item !== null)
}

// How many restored records had a text cut: a note over MAX_NOTE_LENGTH or a
// category name over MAX_CATEGORY_NAME_LENGTH. Each id is counted once.
function countTrimmed(source, result) {
  let total = 0
  for (const name of ['transactions', 'recurring', 'savings']) {
    const kept = new Set(result[name].map((item) => item.id))
    for (const raw of source[name]) {
      if (
        isObject(raw) &&
        kept.delete(raw.id) &&
        typeof raw.note === 'string' &&
        charCount(raw.note) > MAX_NOTE_LENGTH
      ) {
        total++
      }
    }
  }
  const keptCategories = new Set(result.categories.map((c) => c.id))
  for (const raw of source.categories) {
    if (
      isObject(raw) &&
      keptCategories.delete(raw.id) &&
      typeof raw.name === 'string' &&
      charCount(cleanCategoryName(raw.name)) > MAX_CATEGORY_NAME_LENGTH
    ) {
      total++
    }
  }
  return total
}

const LISTS = ['categories', 'transactions', 'budgets', 'recurring', 'savings', 'goals']

// Checks and cleans the text of a backup file and says what happened to it:
//   { ok: false, reason }  reason: 'format' (not a backup of this app),
//                          'newer' (made by a newer version), 'tooBig'
//                          (the text or a list is over the limits)
//   { ok: true, data, counts, dropped, droppedTotal, trimmed }
// data is { transactions, categories, budgets, recurring, savings, goals } ready to
// restore; counts is how many records of each list will be restored, and
// dropped how many were left out (invalid, repeated, or a category whose
// name already exists). trimmed is how many restored records had a note or a
// category name cut to the length the forms allow. It never throws.
// Older backups have no savings or goals: they read as empty lists. A
// transaction may carry an income `source` (salary, freelance, gift, other);
// without one, or with an unknown value, it is null. Backups made
// before the quincena could be configured have no quincenaSchedule: they read
// as 15/30. data also carries quincenaSchedule (not counted in `counts`).
// A backup may carry a profile (name, currency, income, savings goal); without
// one data has no `profile` key. The format stays version 1.
export function inspectBackup(text, builtInCategories) {
  try {
    if (typeof text !== 'string') return { ok: false, reason: 'format' }
    if (text.length > MAX_BACKUP_BYTES) return { ok: false, reason: 'tooBig' }
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return { ok: false, reason: 'format' }
    }
    if (!isObject(data) || data.app !== 'quincena') {
      return { ok: false, reason: 'format' }
    }
    if (Number.isInteger(data.version) && data.version > 1) {
      return { ok: false, reason: 'newer' }
    }
    if (data.version !== 1) return { ok: false, reason: 'format' }
    const lists = [
      data.categories,
      data.transactions,
      data.budgets,
      data.recurring,
    ]
    if (!lists.every(Array.isArray)) return { ok: false, reason: 'format' }
    if (data.savings !== undefined && !Array.isArray(data.savings)) {
      return { ok: false, reason: 'format' }
    }
    if (data.goals !== undefined && !Array.isArray(data.goals)) {
      return { ok: false, reason: 'format' }
    }
    const source = {
      categories: data.categories,
      transactions: data.transactions,
      budgets: data.budgets,
      recurring: data.recurring,
      savings: data.savings ?? [],
      goals: data.goals ?? [],
    }
    if (LISTS.some((name) => source[name].length > MAX_RECORDS)) {
      return { ok: false, reason: 'tooBig' }
    }

    const builtInIds = new Set(builtInCategories.map((c) => c.id))

    // a category whose name is already taken (by a built-in one in any
    // language, or by an earlier one) is merged into it
    const aliases = new Map()
    const keptCategories = []
    for (const raw of source.categories) {
      const category = cleanCategory(raw, builtInIds)
      if (!category) continue
      if (keptCategories.some((c) => c.id === category.id)) continue
      const twin = findCategoryByName(
        [...builtInCategories, ...keptCategories],
        category.name,
      )
      if (twin) {
        aliases.set(category.id, twin.id)
        continue
      }
      keptCategories.push(category)
    }
    const categories = keptCategories
    const knownIds = new Set([...builtInIds, ...categories.map((c) => c.id)])
    const resolve = (item) =>
      isObject(item) && aliases.has(item.categoryId)
        ? { ...item, categoryId: aliases.get(item.categoryId) }
        : item

    const result = {
      categories,
      transactions: keepFirst(
        clean(source.transactions, (tx) => cleanTransaction(resolve(tx), knownIds)),
        (tx) => tx.id,
      ),
      budgets: keepFirst(
        clean(source.budgets, (b) => cleanBudget(resolve(b), knownIds)),
        (b) => `${b.categoryId}-${b.currency}`,
      ),
      recurring: keepFirst(
        clean(source.recurring, (item) => cleanRecurring(resolve(item), knownIds)),
        (item) => item.id,
      ),
      savings: keepFirst(
        clean(source.savings, cleanSavingsMove),
        (move) => move.id,
      ),
      goals: keepFirst(clean(source.goals, cleanGoal), (goal) => goal.id),
      // an older backup has no schedule, and a damaged one reads the same: 15/30
      quincenaSchedule: normalizeSchedule(data.quincenaSchedule),
    }
    // an older backup has no profile: the restore then keeps the current one
    const profile = cleanProfile(data.profile)
    if (profile) result.profile = profile

    const counts = {}
    const dropped = {}
    let droppedTotal = 0
    for (const name of LISTS) {
      counts[name] = result[name].length
      dropped[name] = source[name].length - result[name].length
      droppedTotal += dropped[name]
    }
    const trimmed = countTrimmed(source, result)
    return { ok: true, data: result, counts, dropped, droppedTotal, trimmed }
  } catch {
    return { ok: false, reason: 'format' }
  }
}

// True when there is no valid backup date, or the last backup is older
// than `days` days
export function isBackupDue(lastBackup, today = new Date(), days = 14) {
  if (typeof lastBackup !== 'string' || !isValidDate(lastBackup)) return true
  return daysBetween(parseDate(lastBackup), today) > days
}

// The backup reminder: counts from the last backup (14 days); with none ever
// made, from the oldest transaction and sooner (7 days): that is when the
// person has the most to lose and no copy at all
export const FIRST_BACKUP_DAYS = 7

export function isBackupReminderDue(lastBackup, transactions, today = new Date()) {
  // nothing to back up yet
  if (transactions.length === 0) return false
  if (typeof lastBackup === 'string' && isValidDate(lastBackup)) {
    return isBackupDue(lastBackup, today)
  }
  // dates are zero-padded YYYY-MM-DD, so they compare as strings
  const dates = transactions
    .map((tx) => tx.date)
    .filter((date) => typeof date === 'string' && isValidDate(date))
  if (dates.length === 0) return false
  return isBackupDue(
    dates.reduce((a, b) => (b < a ? b : a)),
    today,
    FIRST_BACKUP_DAYS,
  )
}

// "Movements: 12 · Budgets: 3 · ..." for a list of counts; lists with
// nothing in them are left out. `counts` has the five keys of a backup
// (categories counts only the custom ones). t is the translation function.
export function summarizeCounts(counts, t) {
  const labels = [
    ['transactions', 'listTransactions'],
    ['budgets', 'listBudgets'],
    ['recurring', 'listRecurring'],
    ['savings', 'listSavings'],
    ['goals', 'listGoals'],
    ['categories', 'listCategories'],
  ]
  const parts = labels
    .filter(([name]) => (counts[name] ?? 0) > 0)
    .map(([name, key]) => `${t(key)}: ${counts[name]}`)
  return parts.length > 0 ? parts.join(' · ') : t('listNothing')
}

// "Not now" on the backup reminder hides it for this many days
export const BACKUP_SNOOZE_DAYS = 14

// The date (YYYY-MM-DD) until which the reminder stays hidden
export function backupSnoozeUntil(today = new Date()) {
  const until = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  until.setDate(until.getDate() + BACKUP_SNOOZE_DAYS)
  return todayString(until)
}

// True while the reminder is snoozed: the saved date is valid and still in
// the future. On that date the reminder comes back; a missing or damaged value
// means not snoozed.
export function isBackupReminderSnoozed(snoozedUntil, today = new Date()) {
  if (typeof snoozedUntil !== 'string' || !isValidDate(snoozedUntil)) return false
  return daysBetween(today, parseDate(snoozedUntil)) > 0
}
