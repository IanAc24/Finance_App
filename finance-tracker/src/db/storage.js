import { categories as builtInCategories } from './mockData'
import { getDb, persist } from './database'
import {
  customColorAt,
  customColors,
  findCategoryByName,
} from '../lib/categories'
import { isValidDate, todayString } from '../lib/dates'
import { assertBudgetAmount } from '../lib/validate'
import { EMPTY_PROFILE, cleanCurrency, cleanName } from '../lib/onboarding'
import { normalizeGoal } from '../lib/goals'
import { sourceFor } from '../lib/income'
import { normalizePaymentMethod } from '../lib/payment'
import { DEFAULT_SCHEDULE, normalizeSchedule } from '../lib/quincenaSchedule'
import { MAX_CENTS, isValidAmount } from '../lib/money'

// Same bound as the backup ids: above it new ids could repeat
const MAX_ID = 2_147_483_647

// The only place that knows how data is saved: SQLite, through database.js.
// Amounts are stored as whole cents and converted here, so the rest of the
// app only sees normal numbers.

// The database has one connection: operations run one at a time, in the
// order they were called, so two can never overlap inside a transaction
let queue = Promise.resolve()

function enqueue(work) {
  const result = queue.then(work)
  queue = result.catch(() => {})
  return result
}

function toTransaction(row) {
  return {
    id: row.id,
    amount: row.amount_cents / 100,
    currency: row.currency,
    type: row.type,
    categoryId: row.category_id,
    note: row.note,
    date: row.date,
    paymentMethod: normalizePaymentMethod(row.payment_method),
    source: sourceFor({ type: row.type, source: row.source }),
  }
}

function toGoal(row) {
  return {
    id: row.id,
    name: row.name,
    target: row.target_cents / 100,
    currency: row.currency,
    createdAt: row.created_at,
    achievedAt: row.achieved_at ?? null,
  }
}

function toRecurring(row) {
  return {
    id: row.id,
    amount: row.amount_cents / 100,
    currency: row.currency,
    type: row.type,
    categoryId: row.category_id,
    note: row.note,
    schedule: row.schedule,
    lastPeriod: row.last_period,
  }
}

function toBudget(row) {
  return {
    categoryId: row.category_id,
    currency: row.currency,
    amount: row.amount_cents / 100,
  }
}

function toSavingsMove(row) {
  return {
    id: row.id,
    amount: row.amount_cents / 100,
    currency: row.currency,
    direction: row.direction,
    note: row.note,
    date: row.date,
  }
}

function toScheduleEntry(row) {
  return {
    from: row.effective_from,
    mode: row.mode,
    day1: row.day1,
    day2: row.day2,
  }
}

function toProfile(row) {
  if (!row) return EMPTY_PROFILE
  return {
    name: row.name,
    income: row.income_cents ? row.income_cents / 100 : null,
    currency: cleanCurrency(row.currency),
    savingsGoal: row.savings_goal_cents ? row.savings_goal_cents / 100 : null,
    onboardedAt: row.onboarded_at ?? null,
  }
}

// Built-in rows have a key, custom rows have a name
function toCategory(row) {
  if (row.key !== null) return { id: row.id, key: row.key, color: row.color }
  return { id: row.id, name: row.name, color: row.color }
}

// Whole cents, or an error: nothing that is not a positive amount within the
// app's cap (no NaN, Infinity or 1e308) ever reaches the database
function toCents(amount) {
  const cents = Math.round(amount * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) {
    throw new Error(`Invalid amount: ${amount}`)
  }
  return cents
}

// On web a write is in memory until persist() copies it to IndexedDB. If that
// copy fails the caller is told the save failed, so the write is undone:
// otherwise the row would stay in memory and a retry would save it twice.
async function persistOrUndo(undo) {
  try {
    await persist()
  } catch (error) {
    try {
      await undo()
    } catch (undoError) {
      console.error(undoError)
    }
    throw error
  }
}

const INSERT_TRANSACTION = `INSERT INTO transactions
  (amount_cents, currency, type, category_id, note, date, payment_method, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

function transactionParams(tx) {
  return [
    toCents(tx.amount),
    tx.currency,
    tx.type,
    tx.categoryId,
    tx.note ?? '',
    tx.date,
    normalizePaymentMethod(tx.paymentMethod),
    sourceFor(tx),
  ]
}

// OR REPLACE only ever replaces the row with the same id: a move saved twice
// with the id its caller made (a retry) stays one row. Without an id (NULL)
// the database picks the next one, as always.
const INSERT_SAVINGS = `INSERT OR REPLACE INTO savings
  (id, amount_cents, currency, direction, note, date)
  VALUES (?, ?, ?, ?, ?, ?)`

// A move id made by the caller, or null for "pick one"
function moveId(move) {
  if (move.id === undefined || move.id === null) return null
  if (!Number.isSafeInteger(move.id) || move.id <= 0) {
    throw new Error(`Invalid savings move id: ${move.id}`)
  }
  return move.id
}

function savingsParams(move) {
  return [
    moveId(move),
    toCents(move.amount),
    move.currency,
    move.direction,
    move.note ?? '',
    move.date,
  ]
}

const INSERT_GOAL = `INSERT OR REPLACE INTO goals
  (id, name, target_cents, currency, created_at, achieved_at)
  VALUES (?, ?, ?, ?, ?, ?)`

function goalParams(goal) {
  const clean = normalizeGoal(goal)
  return [
    moveId(goal),
    clean.name,
    toCents(clean.target),
    clean.currency,
    clean.createdAt,
    clean.achievedAt,
  ]
}

// Runs the work in one transaction: all of it is saved or none of it.
// The work must pass false as the transaction argument to run/execute.
async function inTransaction(db, work) {
  await db.beginTransaction()
  try {
    const result = await work()
    await db.commitTransaction()
    return result
  } catch (error) {
    if ((await db.isTransactionActive()).result) {
      await db.rollbackTransaction()
    }
    throw error
  }
}

// --- Legacy import ---------------------------------------------------------
// Older versions saved everything in localStorage. That data is copied into
// the database once; the old copy is never changed, it stays as a backup.
const LEGACY_KEY = 'finance-data'
const IMPORTED_FLAG = 'finance-data-imported'

function isValidTransaction(tx) {
  return (
    Number.isInteger(tx?.id) &&
    tx.id > 0 &&
    tx.id <= MAX_ID &&
    isValidAmount(tx.amount) &&
    (tx.type === 'income' || tx.type === 'expense') &&
    (tx.currency === 'CRC' || tx.currency === 'USD') &&
    isValidDate(tx.date)
  )
}

function isValidCustomCategory(c) {
  return (
    Number.isInteger(c?.id) &&
    c.id > 0 &&
    c.id <= MAX_ID &&
    typeof c.name === 'string' &&
    c.name.trim() !== '' &&
    !builtInCategories.some((builtIn) => builtIn.id === c.id)
  )
}

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_KEY)) ?? {}
  } catch {
    return {}
  }
}

// Keeps the first item of each id: a repeated id would make the import fail
function uniqueById(items) {
  const seen = new Set()
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id))
}

// Missing or corrupted data reads as nothing to import
function readLegacy() {
  const saved = readSaved()
  const transactions = uniqueById(
    Array.isArray(saved.transactions)
      ? saved.transactions.filter(isValidTransaction)
      : [],
  )
  // a custom category saved without a valid color gets one by its position
  const categories = uniqueById(
    Array.isArray(saved.categories)
      ? saved.categories.filter(isValidCustomCategory)
      : [],
  ).map((c, index) =>
    customColors.includes(c.color) ? c : { ...c, color: customColorAt(index) },
  )
  return { transactions, categories }
}

function isImported() {
  try {
    return localStorage.getItem(IMPORTED_FLAG) === '1'
  } catch {
    return false
  }
}

function markImported() {
  try {
    localStorage.setItem(IMPORTED_FLAG, '1')
  } catch {
    // blocked: the database check stops a second import anyway
  }
}

async function importLegacyData(db) {
  if (isImported()) return

  const legacy = readLegacy()
  if (legacy.transactions.length === 0 && legacy.categories.length === 0) {
    markImported()
    return
  }

  const counts = (
    await db.query(
      `SELECT
        (SELECT COUNT(*) FROM transactions) AS transactions,
        (SELECT COUNT(*) FROM categories WHERE key IS NULL) AS custom`,
    )
  ).values[0]
  if (counts.transactions > 0 || counts.custom > 0) {
    markImported()
    return
  }

  const knownIds = new Set([
    ...builtInCategories.map((c) => c.id),
    ...legacy.categories.map((c) => c.id),
  ])
  await inTransaction(db, async () => {
    for (const { id, name, color } of legacy.categories) {
      await db.run(
        'INSERT INTO categories (id, name, color) VALUES (?, ?, ?)',
        [id, name, color],
        false,
      )
    }
    for (const tx of legacy.transactions) {
      const categoryId = knownIds.has(tx.categoryId) ? tx.categoryId : null
      await db.run(
        `INSERT INTO transactions
          (id, amount_cents, currency, type, category_id, note, date,
            payment_method, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tx.id, ...transactionParams({ ...tx, categoryId })],
        false,
      )
    }
    // someone who had data before the welcome existed never sees it
    const profile = await readProfile(db)
    await writeProfile(db, {
      ...profile,
      onboardedAt: profile.onboardedAt ?? todayString(),
    })
  })
  await persist()
  markImported()
}

// loadAll can be called twice at once (React StrictMode runs effects twice):
// both calls share one import, or the second would start a transaction
// inside the first one's
let importPromise = null

function importLegacyDataOnce(db) {
  if (!importPromise) {
    importPromise = importLegacyData(db).catch((error) => {
      importPromise = null
      throw error
    })
  }
  return importPromise
}
// --- End of legacy import --------------------------------------------------

// The whole schedule: the 15/30 and pay-day rows plus the days marked as paid
async function readSchedule(db) {
  const rows = (
    await db.query('SELECT * FROM quincena_config ORDER BY effective_from')
  ).values.map(toScheduleEntry)
  const manual = (await db.query('SELECT start_date FROM quincena_manual')).values.map(
    (row) => ({ from: row.start_date, mode: 'manual', day1: 1, day2: null }),
  )
  return normalizeSchedule([...rows, ...manual])
}

async function readAll(db) {
  const categories = await db.query('SELECT * FROM categories ORDER BY id')
  const transactions = await db.query('SELECT * FROM transactions ORDER BY id')
  const budgets = await db.query(
    'SELECT * FROM budgets ORDER BY category_id, currency',
  )
  const recurring = await db.query('SELECT * FROM recurring ORDER BY id')
  const savings = await db.query('SELECT * FROM savings ORDER BY id')
  const profile = await db.query('SELECT * FROM profile WHERE id = 1')
  const goals = await db.query('SELECT * FROM goals ORDER BY id')
  return {
    profile: toProfile(profile.values[0]),
    goals: goals.values.map(toGoal),
    transactions: transactions.values.map(toTransaction),
    categories: categories.values.map(toCategory),
    budgets: budgets.values.map(toBudget),
    recurring: recurring.values.map(toRecurring),
    savings: savings.values.map(toSavingsMove),
    quincenaSchedule: await readSchedule(db),
  }
}

// Replaces the schedule rows; the caller runs this inside a transaction
async function writeSchedule(db, schedule) {
  await db.run('DELETE FROM quincena_config', [], false)
  await db.run('DELETE FROM quincena_manual', [], false)
  for (const entry of normalizeSchedule(schedule)) {
    if (entry.mode === 'manual') {
      await db.run(
        'INSERT INTO quincena_manual (start_date) VALUES (?)',
        [entry.from],
        false,
      )
      continue
    }
    await db.run(
      `INSERT INTO quincena_config (effective_from, mode, day1, day2)
        VALUES (?, ?, ?, ?)`,
      [entry.from, entry.mode, entry.day1, entry.day2],
      false,
    )
  }
}

// Saves the one profile row (it is created if it is somehow missing); the
// caller runs this inside a transaction
async function writeProfile(db, profile) {
  const cents = (amount) => (amount > 0 ? toCents(amount) : null)
  await db.run(
    `INSERT INTO profile
      (id, name, income_cents, currency, savings_goal_cents, onboarded_at)
      VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        income_cents = excluded.income_cents,
        currency = excluded.currency,
        savings_goal_cents = excluded.savings_goal_cents,
        onboarded_at = excluded.onboarded_at`,
    [
      cleanName(profile.name),
      cents(profile.income),
      cleanCurrency(profile.currency),
      cents(profile.savingsGoal),
      profile.onboardedAt ?? null,
    ],
    false,
  )
}

async function readProfile(db) {
  const result = await db.query('SELECT * FROM profile WHERE id = 1')
  return toProfile(result.values[0])
}

export function loadAll() {
  return enqueue(async () => {
    const db = await getDb()
    await importLegacyDataOnce(db)
    return readAll(db)
  })
}

// Replaces everything with the cleaned data of a backup, in one transaction
export function restoreAll(data) {
  return enqueue(async () => {
    const db = await getDb()
    await inTransaction(db, async () => {
      await db.run('DELETE FROM budgets', [], false)
      await db.run('DELETE FROM recurring', [], false)
      await db.run('DELETE FROM savings', [], false)
      await db.run('DELETE FROM goals', [], false)
      await db.run('DELETE FROM transactions', [], false)
      await db.run('DELETE FROM categories WHERE key IS NULL', [], false)
      for (const { id, name, color } of data.categories) {
        await db.run(
          'INSERT INTO categories (id, name, color) VALUES (?, ?, ?)',
          [id, name, color],
          false,
        )
      }
      for (const tx of data.transactions) {
        await db.run(
          `INSERT INTO transactions
            (id, amount_cents, currency, type, category_id, note, date,
              payment_method, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tx.id, ...transactionParams(tx)],
          false,
        )
      }
      for (const b of data.budgets) {
        await db.run(
          `INSERT INTO budgets (category_id, currency, amount_cents)
            VALUES (?, ?, ?)`,
          [b.categoryId, b.currency, toCents(b.amount)],
          false,
        )
      }
      for (const item of data.recurring) {
        await db.run(
          `INSERT INTO recurring
            (id, amount_cents, currency, type, category_id, note, schedule,
              last_period)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.id, ...recurringParams(item), item.lastPeriod],
          false,
        )
      }
      for (const move of data.savings ?? []) {
        await db.run(
          INSERT_SAVINGS,
          savingsParams(move),
          false,
        )
      }
      for (const goal of data.goals ?? []) {
        await db.run(INSERT_GOAL, goalParams(goal), false)
      }
      // a backup without the setting is 15/30
      await writeSchedule(db, data.quincenaSchedule ?? DEFAULT_SCHEDULE)
      // a backup without a profile (an older one) keeps the current one; in
      // any case the person has data now, so the welcome is done
      const profile = await readProfile(db)
      await writeProfile(db, {
        ...profile,
        ...data.profile,
        onboardedAt: profile.onboardedAt ?? todayString(),
      })
    })
    await persist()
    return readAll(db)
  })
}

export function insertTransaction(tx) {
  return enqueue(async () => {
    const db = await getDb()
    const result = await db.run(INSERT_TRANSACTION, transactionParams(tx))
    const id = result.changes.lastId
    await persistOrUndo(() =>
      db.run('DELETE FROM transactions WHERE id = ?', [id]),
    )
    return {
      ...tx,
      note: tx.note ?? '',
      paymentMethod: normalizePaymentMethod(tx.paymentMethod),
      source: sourceFor(tx),
      id,
    }
  })
}

export function insertTransactions(list) {
  return enqueue(async () => {
    const db = await getDb()
    const saved = await inTransaction(db, async () => {
      const items = []
      for (const tx of list) {
        const result = await db.run(
          INSERT_TRANSACTION,
          transactionParams(tx),
          false,
        )
        items.push({
          ...tx,
          note: tx.note ?? '',
          paymentMethod: normalizePaymentMethod(tx.paymentMethod),
          source: sourceFor(tx),
          id: result.changes.lastId,
        })
      }
      return items
    })
    await persistOrUndo(async () => {
      for (const item of saved) {
        await db.run('DELETE FROM transactions WHERE id = ?', [item.id])
      }
    })
    return saved
  })
}

export function updateTransaction(id, tx) {
  return enqueue(async () => {
    const db = await getDb()
    await db.run(
      `UPDATE transactions SET
        amount_cents = ?, currency = ?, type = ?, category_id = ?, note = ?,
        date = ?, payment_method = ?, source = ?
        WHERE id = ?`,
      [...transactionParams(tx), id],
    )
    await persist()
    return {
      ...tx,
      note: tx.note ?? '',
      paymentMethod: normalizePaymentMethod(tx.paymentMethod),
      id,
    }
  })
}

export function deleteTransaction(id) {
  return enqueue(async () => {
    const db = await getDb()
    await db.run('DELETE FROM transactions WHERE id = ?', [id])
    await persist()
  })
}

export function insertCategory({ name, color }) {
  return enqueue(async () => {
    const db = await getDb()
    const result = await db.run(
      'INSERT INTO categories (name, color) VALUES (?, ?)',
      [name, color],
    )
    const id = result.changes.lastId
    await persistOrUndo(() =>
      db.run('DELETE FROM categories WHERE id = ?', [id]),
    )
    return { id, name, color }
  })
}

export function updateCategory(id, { name, color }) {
  return enqueue(async () => {
    const db = await getDb()
    await db.run(
      'UPDATE categories SET name = ?, color = ? WHERE id = ? AND key IS NULL',
      [name, color, id],
    )
    await persist()
    return { id, name, color }
  })
}

// Its transactions move to another category first, in the same transaction
export function deleteCategory(id, moveToId) {
  return enqueue(async () => {
    const db = await getDb()
    // built-in categories stay, and so do their transactions
    const custom = await db.query(
      'SELECT id FROM categories WHERE id = ? AND key IS NULL',
      [id],
    )
    if (custom.values.length === 0) return
    await inTransaction(db, async () => {
      await db.run(
        'UPDATE transactions SET category_id = ? WHERE category_id = ?',
        [moveToId, id],
        false,
      )
      await db.run(
        'UPDATE recurring SET category_id = ? WHERE category_id = ?',
        [moveToId, id],
        false,
      )
      await db.run(
        'DELETE FROM categories WHERE id = ? AND key IS NULL',
        [id],
        false,
      )
    })
    await persist()
  })
}

export function clearAll() {
  return enqueue(async () => {
    const db = await getDb()
    await inTransaction(db, async () => {
      await db.run('DELETE FROM budgets', [], false)
      await db.run('DELETE FROM recurring', [], false)
      await db.run('DELETE FROM savings', [], false)
      await db.run('DELETE FROM goals', [], false)
      await db.run('DELETE FROM transactions', [], false)
      await db.run('DELETE FROM categories WHERE key IS NULL', [], false)
      // back to 15/30 and to a person who has not seen the welcome
      await writeSchedule(db, DEFAULT_SCHEDULE)
      await writeProfile(db, EMPTY_PROFILE)
    })
    await persist()
  })
}

// An amount of 0 (or none) removes the budget; returns the saved budget or null
export function setBudget(categoryId, currency, amount) {
  return enqueue(async () => {
    assertBudgetAmount(amount)
    const db = await getDb()
    if (amount > 0) {
      await db.run(
        `INSERT INTO budgets (category_id, currency, amount_cents)
          VALUES (?, ?, ?)
          ON CONFLICT (category_id, currency)
          DO UPDATE SET amount_cents = excluded.amount_cents`,
        [categoryId, currency, toCents(amount)],
      )
      await persist()
      return { categoryId, currency, amount }
    }
    await db.run('DELETE FROM budgets WHERE category_id = ? AND currency = ?', [
      categoryId,
      currency,
    ])
    await persist()
    return null
  })
}

function recurringParams(item) {
  return [
    toCents(item.amount),
    item.currency,
    item.type,
    item.categoryId,
    item.note ?? '',
    item.schedule,
  ]
}

export function insertRecurring(item) {
  return enqueue(async () => {
    const db = await getDb()
    const result = await db.run(
      `INSERT INTO recurring
        (amount_cents, currency, type, category_id, note, schedule)
        VALUES (?, ?, ?, ?, ?, ?)`,
      recurringParams(item),
    )
    const id = result.changes.lastId
    await persistOrUndo(() => db.run('DELETE FROM recurring WHERE id = ?', [id]))
    return { ...item, note: item.note ?? '', id, lastPeriod: null }
  })
}

// last_period is not touched here: only confirm and skip change it
export function updateRecurring(id, item) {
  return enqueue(async () => {
    const db = await getDb()
    await db.run(
      `UPDATE recurring SET
        amount_cents = ?, currency = ?, type = ?, category_id = ?, note = ?,
        schedule = ?
        WHERE id = ?`,
      [...recurringParams(item), id],
    )
    await persist()
    return { ...item, note: item.note ?? '', id }
  })
}

export function deleteRecurring(id) {
  return enqueue(async () => {
    const db = await getDb()
    await db.run('DELETE FROM recurring WHERE id = ?', [id])
    await persist()
  })
}

export function skipRecurring(id, period) {
  return enqueue(async () => {
    const db = await getDb()
    await db.run('UPDATE recurring SET last_period = ? WHERE id = ?', [
      period,
      id,
    ])
    await persist()
  })
}

// Adds the transaction and marks the item as handled in one transaction
export function confirmRecurring(id, period, tx) {
  return enqueue(async () => {
    const db = await getDb()
    const before = await db.query(
      'SELECT last_period FROM recurring WHERE id = ?',
      [id],
    )
    const saved = await inTransaction(db, async () => {
      const result = await db.run(
        INSERT_TRANSACTION,
        transactionParams(tx),
        false,
      )
      await db.run(
        'UPDATE recurring SET last_period = ? WHERE id = ?',
        [period, id],
        false,
      )
      return {
        ...tx,
        note: tx.note ?? '',
        paymentMethod: normalizePaymentMethod(tx.paymentMethod),
        source: sourceFor(tx),
        id: result.changes.lastId,
      }
    })
    await persistOrUndo(async () => {
      await db.run('DELETE FROM transactions WHERE id = ?', [saved.id])
      await db.run('UPDATE recurring SET last_period = ? WHERE id = ?', [
        before.values[0]?.last_period ?? null,
        id,
      ])
    })
    return saved
  })
}

// What saving this move would overwrite (a retry with the same id) and the
// goals about to be marked as reached, to put back if the copy to IndexedDB
// fails
async function snapshotBeforeMove(db, move, goalIds) {
  const id = moveId(move)
  const previous =
    id === null
      ? null
      : ((await db.query('SELECT * FROM savings WHERE id = ?', [id])).values[0] ??
        null)
  const goals = []
  for (const goalId of goalIds) {
    const row = (
      await db.query('SELECT id, achieved_at FROM goals WHERE id = ?', [goalId])
    ).values[0]
    if (row) goals.push(row)
  }
  return { previous, goals }
}

// Writes the move and marks the goals it reached in the SAME transaction (the
// caller opened it). Only a deposit reaches goals, and only goals not
// achieved yet are touched. Returns the move id and the goals really marked.
async function writeMove(db, move, options) {
  const result = await db.run(INSERT_SAVINGS, savingsParams(move), false)
  const achievedGoalIds = []
  if (move.direction === 'in') {
    const achievedAt = options.achievedAt ?? todayString()
    for (const goalId of options.achieveGoalIds ?? []) {
      const marked = await db.run(
        'UPDATE goals SET achieved_at = ? WHERE id = ? AND achieved_at IS NULL',
        [achievedAt, goalId],
        false,
      )
      if (marked.changes.changes > 0) achievedGoalIds.push(goalId)
    }
  }
  return { id: result.changes.lastId, achievedGoalIds }
}

async function undoMove(db, id, snapshot) {
  if (snapshot.previous) {
    const p = snapshot.previous
    await db.run(INSERT_SAVINGS, [
      p.id,
      p.amount_cents,
      p.currency,
      p.direction,
      p.note,
      p.date,
    ])
  } else {
    await db.run('DELETE FROM savings WHERE id = ?', [id])
  }
  for (const goal of snapshot.goals) {
    await db.run('UPDATE goals SET achieved_at = ? WHERE id = ?', [
      goal.achieved_at,
      goal.id,
    ])
  }
}

// Saves a savings move (and marks the goals it reached, see writeMove) in one
// transaction. `move.id`, when given, is the id the caller made once for this
// action: saving again with it overwrites the same row instead of adding one.
//   options: { achieveGoalIds, achievedAt, awaitServer }
// Returns { move, status: 'confirmed', achievedGoalIds }; there is no server
// here, so it is confirmed once the SQL and the copy to IndexedDB succeed.
export function saveSavingsMove(move, options = {}) {
  return enqueue(async () => {
    const db = await getDb()
    const snapshot = await snapshotBeforeMove(
      db,
      move,
      options.achieveGoalIds ?? [],
    )
    const written = await inTransaction(db, () => writeMove(db, move, options))
    await persistOrUndo(() => undoMove(db, written.id, snapshot))
    return {
      move: { ...move, note: move.note ?? '', id: written.id },
      status: 'confirmed',
      achievedGoalIds: written.achievedGoalIds,
    }
  })
}

// Same as saveSavingsMove, returning only the saved move
export async function insertSavingsMove(move, options = {}) {
  return (await saveSavingsMove(move, options)).move
}

export function deleteSavingsMove(id) {
  return enqueue(async () => {
    const db = await getDb()
    await db.run('DELETE FROM savings WHERE id = ?', [id])
    await persist()
  })
}

// Adds an income and the part of it sent to savings in one transaction (the
// goals the deposit reached are marked in it too, see saveSavingsMove).
// Returns { transaction, move, status, achievedGoalIds }.
export function insertIncomeWithSavings(tx, move, options = {}) {
  return enqueue(async () => {
    const db = await getDb()
    const snapshot = await snapshotBeforeMove(
      db,
      move,
      options.achieveGoalIds ?? [],
    )
    const saved = await inTransaction(db, async () => {
      const txResult = await db.run(
        INSERT_TRANSACTION,
        transactionParams(tx),
        false,
      )
      const written = await writeMove(db, move, options)
      return {
        transaction: {
          ...tx,
          note: tx.note ?? '',
          paymentMethod: normalizePaymentMethod(tx.paymentMethod),
          source: sourceFor(tx),
          id: txResult.changes.lastId,
        },
        move: { ...move, note: move.note ?? '', id: written.id },
        status: 'confirmed',
        achievedGoalIds: written.achievedGoalIds,
      }
    })
    await persistOrUndo(async () => {
      await db.run('DELETE FROM transactions WHERE id = ?', [
        saved.transaction.id,
      ])
      await undoMove(db, saved.move.id, snapshot)
    })
    return saved
  })
}

// --- Savings goals ---------------------------------------------------------
// Each returns { goal, status } like the cloud version; status is always
// 'confirmed' here (see saveSavingsMove).

// `goal.id`, when given, is the id the caller made once (a retry overwrites)
export function insertGoal(goal) {
  return enqueue(async () => {
    const db = await getDb()
    const params = goalParams(goal)
    const clean = normalizeGoal(goal)
    const previous =
      params[0] === null
        ? null
        : ((await db.query('SELECT * FROM goals WHERE id = ?', [params[0]]))
            .values[0] ?? null)
    const result = await db.run(INSERT_GOAL, params)
    const id = result.changes.lastId
    await persistOrUndo(async () => {
      if (previous) {
        await db.run(INSERT_GOAL, [
          previous.id,
          previous.name,
          previous.target_cents,
          previous.currency,
          previous.created_at,
          previous.achieved_at,
        ])
      } else {
        await db.run('DELETE FROM goals WHERE id = ?', [id])
      }
    })
    return { goal: { ...clean, id }, status: 'confirmed' }
  })
}

// Replaces the whole goal (name, target, currency and the two dates)
export function updateGoal(id, goal) {
  return enqueue(async () => {
    const db = await getDb()
    const clean = normalizeGoal({ ...goal, id: undefined })
    const sql = `UPDATE goals SET name = ?, target_cents = ?, currency = ?,
      created_at = ?, achieved_at = ? WHERE id = ?`
    const before = (await db.query('SELECT * FROM goals WHERE id = ?', [id]))
      .values[0]
    if (!before) throw new Error(`Goal not found: ${id}`)
    await db.run(sql, [
      clean.name,
      toCents(clean.target),
      clean.currency,
      clean.createdAt,
      clean.achievedAt,
      id,
    ])
    await persistOrUndo(() =>
      db.run(sql, [
        before.name,
        before.target_cents,
        before.currency,
        before.created_at,
        before.achieved_at,
        id,
      ]),
    )
    return { goal: { ...clean, id }, status: 'confirmed' }
  })
}

export function deleteGoal(id) {
  return enqueue(async () => {
    const db = await getDb()
    await db.run('DELETE FROM goals WHERE id = ?', [id])
    await persist()
  })
}

// Saves the whole schedule (the list is short: one entry per change)
export function saveQuincenaSchedule(schedule) {
  return enqueue(async () => {
    const db = await getDb()
    const before = await readSchedule(db)
    await inTransaction(db, () => writeSchedule(db, schedule))
    await persistOrUndo(() => inTransaction(db, () => writeSchedule(db, before)))
    return normalizeSchedule(schedule)
  })
}

// Finishes the welcome in one transaction: all of it is saved or none of it.
//   profile: { name, currency, income, savingsGoal }
//   schedule: the new quincena schedule, or null to leave it as it is
//   add: recurring items to create; update: { id, item } to change one
// Returns the whole state, like loadAll.
export function completeOnboarding({
  profile,
  schedule = null,
  add = [],
  update = null,
}) {
  return enqueue(async () => {
    const db = await getDb()
    const before = {
      profile: await readProfile(db),
      schedule: await readSchedule(db),
      recurring: update
        ? (await db.query('SELECT * FROM recurring WHERE id = ?', [update.id]))
            .values[0]
        : null,
    }
    const createdCategories = []
    const ids = await inTransaction(db, async () => {
      if (schedule) await writeSchedule(db, schedule)
      // an expense with a `newCategory` name creates it (or finds the one
      // that already has that name), in this same transaction
      const known = (await db.query('SELECT * FROM categories ORDER BY id'))
        .values.map(toCategory)
      const created = []
      for (const original of add) {
        let item = original
        if (original.newCategory) {
          let category = findCategoryByName(known, original.newCategory)
          if (!category) {
            const color = customColorAt(known.filter((c) => c.name).length)
            const made = await db.run(
              'INSERT INTO categories (name, color) VALUES (?, ?)',
              [original.newCategory, color],
              false,
            )
            category = {
              id: made.changes.lastId,
              name: original.newCategory,
              color,
            }
            known.push(category)
            createdCategories.push(category.id)
          }
          item = { ...original, categoryId: category.id }
        }
        const result = await db.run(
          `INSERT INTO recurring
            (amount_cents, currency, type, category_id, note, schedule)
            VALUES (?, ?, ?, ?, ?, ?)`,
          recurringParams(item),
          false,
        )
        created.push(result.changes.lastId)
      }
      if (update) {
        const result = await db.run(
          `UPDATE recurring SET
            amount_cents = ?, currency = ?, type = ?, category_id = ?,
            note = ?, schedule = ?
            WHERE id = ?`,
          [...recurringParams(update.item), update.id],
          false,
        )
        // the item was deleted meanwhile: fail instead of reporting a save
        if (result.changes.changes === 0) {
          throw new Error(`Recurring item not found: ${update.id}`)
        }
      }
      await writeProfile(db, { ...profile, onboardedAt: todayString() })
      return created
    })
    await persistOrUndo(() =>
      inTransaction(db, async () => {
        for (const id of ids) {
          await db.run('DELETE FROM recurring WHERE id = ?', [id], false)
        }
        if (before.recurring) {
          await db.run(
            `UPDATE recurring SET amount_cents = ?, currency = ?, type = ?,
              category_id = ?, note = ?, schedule = ? WHERE id = ?`,
            [
              before.recurring.amount_cents,
              before.recurring.currency,
              before.recurring.type,
              before.recurring.category_id,
              before.recurring.note,
              before.recurring.schedule,
              before.recurring.id,
            ],
            false,
          )
        }
        for (const id of createdCategories) {
          await db.run('DELETE FROM categories WHERE id = ?', [id], false)
        }
        await writeSchedule(db, before.schedule)
        await writeProfile(db, before.profile)
      }),
    )
    return readAll(db)
  })
}

// Skips the welcome (or changes nothing in a repeat): only the date is saved
export function skipOnboarding() {
  return enqueue(async () => {
    const db = await getDb()
    const before = await readProfile(db)
    await inTransaction(db, () =>
      writeProfile(db, { ...before, onboardedAt: todayString() }),
    )
    await persistOrUndo(() => inTransaction(db, () => writeProfile(db, before)))
    return readProfile(db)
  })
}

// Settings: the name shown on Home ('' removes it)
export function saveProfileName(name) {
  return enqueue(async () => {
    const db = await getDb()
    const before = await readProfile(db)
    const after = { ...before, name: cleanName(name) }
    await inTransaction(db, () => writeProfile(db, after))
    await persistOrUndo(() => inTransaction(db, () => writeProfile(db, before)))
    return readProfile(db)
  })
}
