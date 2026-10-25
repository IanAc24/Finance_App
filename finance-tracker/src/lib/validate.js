import { isValidDate } from './dates'
import { MAX_AMOUNT, currencies, isValidAmount } from './money'
import { MAX_CATEGORY_NAME_LENGTH, MAX_NOTE_LENGTH } from './limits'
import { cleanCategoryName } from './categories'
import { schedules } from './recurring'

// Checks made right before anything is written, whichever store is behind
// (SQLite or Firestore). The screens already stop most of this; these are
// the last guard against a bug or a damaged value reaching the database.
// Each function throws an Error with code 'invalidInput' and a `field` that
// says what was wrong, or returns when everything is fine. Stored data is
// never checked here, only what is about to be saved.

const currencyCodes = currencies.map((c) => c.code)

function fail(field) {
  return Object.assign(new Error(`Invalid input: ${field}`), {
    code: 'invalidInput',
    field,
  })
}

// Characters as a person counts them (an emoji is one), so a limit never
// cuts one in half. The text fields stop at the limit in UTF-16 units, which
// is the same or stricter.
function textLength(text) {
  return Array.from(text).length
}

// A missing note is an empty one; anything but text is not a note
function checkNote(note) {
  if (note === undefined || note === null) return
  if (typeof note !== 'string') throw fail('note')
  if (textLength(note.trim()) > MAX_NOTE_LENGTH) throw fail('note')
}

function checkCommon(item) {
  if (!item || typeof item !== 'object') throw fail('item')
  if (!currencyCodes.includes(item.currency)) throw fail('currency')
  if (!isValidAmount(item.amount)) throw fail('amount')
  checkNote(item.note)
}

// { amount, currency, type, date, note, ... } of a movement
export function assertTransaction(tx) {
  checkCommon(tx)
  if (tx.type !== 'expense' && tx.type !== 'income') throw fail('type')
  if (typeof tx.date !== 'string' || !isValidDate(tx.date)) throw fail('date')
}

// { amount, currency, direction, date, note } of a savings move
export function assertSavingsMove(move) {
  checkCommon(move)
  if (move.direction !== 'in' && move.direction !== 'out') throw fail('direction')
  if (typeof move.date !== 'string' || !isValidDate(move.date)) throw fail('date')
}

// { amount, currency, type, schedule, note } of a recurring item
export function assertRecurring(item) {
  checkCommon(item)
  if (item.type !== 'expense' && item.type !== 'income') throw fail('type')
  if (!schedules.includes(item.schedule)) throw fail('schedule')
}

// A category name that can be saved: text that is not empty once trimmed and
// with its spaces collapsed, and within the limit. Returns the cleaned name.
export function assertCategoryName(name) {
  if (typeof name !== 'string') throw fail('name')
  const clean = cleanCategoryName(name)
  if (clean === '' || textLength(clean) > MAX_CATEGORY_NAME_LENGTH) throw fail('name')
  return clean
}

// The amount of a budget. 0, undefined and null mean "remove it" and pass;
// a negative, non-numeric, non-finite or too large amount throws.
export function assertBudgetAmount(amount) {
  if (amount === undefined || amount === null || amount === 0) return
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw fail('amount')
  if (amount < 0 || amount > MAX_AMOUNT) throw fail('amount')
}
