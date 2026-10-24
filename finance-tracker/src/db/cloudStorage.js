import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { categories as builtInCategories } from './mockData'
import { getCloudDb } from '../lib/firebase'
import { customColorAt, findCategoryByName } from '../lib/categories'
import { isValidDate, todayString } from '../lib/dates'
import { normalizeGoal } from '../lib/goals'
import { sourceFor } from '../lib/income'
import { newId } from '../lib/ids'
import { MAX_GOAL_NAME_LENGTH } from '../lib/limits'
import { MAX_CENTS } from '../lib/money'
import { EMPTY_PROFILE, cleanCurrency, cleanName } from '../lib/onboarding'
import { normalizePaymentMethod } from '../lib/payment'
import { DEFAULT_SCHEDULE, normalizeSchedule } from '../lib/quincenaSchedule'

// The same operations as storage.js, but each account's data is saved in
// Firestore under users/{uid}/ and only that account can read it (see
// firestore.rules). Firestore keeps a copy in the browser, so reads work
// without internet and writes are queued until it is back.
//
//   users/{uid}/transactions/{id}   amountCents, currency, type, categoryId,
//                                   note, date, paymentMethod, source
//                                   (source: only incomes, absent = none)
//   users/{uid}/categories/{id}     name, color (custom ones; the built-in
//                                   ones are fixed in mockData.js)
//   users/{uid}/budgets/{cat_cur}   categoryId, currency, amountCents
//   users/{uid}/recurring/{id}      amountCents, currency, type, categoryId,
//                                   note, schedule, lastPeriod
//   users/{uid}/savings/{id}        amountCents, currency, direction, note, date
//   users/{uid}/goals/{id}          name, targetCents, currency, createdAt,
//                                   achievedAt (null until reached)
//   users/{uid}/meta/profile        name, incomeCents, currency,
//                                   savingsGoalCents, onboardedAt
//   users/{uid}/meta/schedule       entries (the quincena schedule)
//
// Amounts are whole cents, as in SQLite. Ids are numbers made on the device
// (lib/ids.js) and are also the document names.

let uid = null

// The account whose data is read and written (TransactionsProvider sets it)
export function setCloudUser(id) {
  uid = id
}

function userPath() {
  if (!uid) throw new Error('No signed-in account for the cloud data')
  return ['users', uid]
}

const listOf = (name) => collection(getCloudDb(), ...userPath(), name)
const itemOf = (name, id) => doc(getCloudDb(), ...userPath(), name, String(id))
const metaOf = (name) => doc(getCloudDb(), ...userPath(), 'meta', name)
const budgetId = (categoryId, currency) => `${categoryId}_${currency}`

// --- Writing ---------------------------------------------------------------

// How long a save waits for Firebase before it is taken as done. Online the
// answer comes much sooner, so a rejected write is reported as a failed save.
// Offline commit() only ends when the internet is back: the change is
// already in the browser copy, so the app goes on and Firebase sends it later.
export const WRITE_WAIT_MS = 1000

// The longer wait of a save that must be confirmed by Google ({ awaitServer:
// true }): after this long without an answer the save is reported as
// 'pending' (it stays queued in the browser and syncs when it can)
export const CONFIRM_WAIT_MS = 8000

const errorListeners = new Set()

// Called with the error when Firebase rejects a write after the app went on
// (for example once the internet is back). Returns the function that stops.
export function onCloudWriteError(listener) {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

// Resolves 'confirmed' when Firebase answered ok, 'pending' when it had not
// answered after waitMs (the write is queued and goes on in the background),
// and rejects when Firebase refuses it in time
function commitBatch(batch, waitMs = WRITE_WAIT_MS) {
  const sent = batch.commit()
  return new Promise((resolve, reject) => {
    let waiting = true
    const timer = setTimeout(() => {
      waiting = false
      resolve('pending')
    }, waitMs)
    sent.then(
      () => {
        if (!waiting) return
        waiting = false
        clearTimeout(timer)
        resolve('confirmed')
      },
      (error) => {
        if (waiting) {
          waiting = false
          clearTimeout(timer)
          reject(error)
          return
        }
        for (const listener of errorListeners) listener(error)
      },
    )
  })
}

// Firestore takes up to 500 writes in one batch. Bigger jobs (a restore, an
// import) are split; every write names its document, so running the job
// again after a failure overwrites instead of adding duplicates.
const BATCH_LIMIT = 450

function newWriter() {
  const db = getCloudDb()
  const batches = [writeBatch(db)]
  let count = 0
  const current = () => {
    if (count === BATCH_LIMIT) {
      batches.push(writeBatch(db))
      count = 0
    }
    count += 1
    return batches[batches.length - 1]
  }
  return {
    set: (target, data) => current().set(target, data),
    update: (target, data) => current().update(target, data),
    delete: (target) => current().delete(target),
    // 'confirmed' only if every batch was; { awaitServer: true } waits longer
    commit: async ({ awaitServer = false } = {}) => {
      const waitMs = awaitServer ? CONFIRM_WAIT_MS : WRITE_WAIT_MS
      const results = await Promise.all(
        batches.map((batch) => commitBatch(batch, waitMs)),
      )
      return results.every((status) => status === 'confirmed')
        ? 'confirmed'
        : 'pending'
    },
  }
}

// --- Reading ---------------------------------------------------------------

// `fresh` asks Firebase (falling back to the browser copy without internet);
// otherwise the browser copy is used, which already has every document since
// loadAll and includes the changes not sent yet
async function readList(target, fresh) {
  if (fresh) {
    try {
      return await getDocs(target)
    } catch (error) {
      console.warn('cloud read', error?.code ?? 'unknown')
    }
  }
  return getDocsFromCache(target)
}

async function readItem(target, fresh) {
  if (!fresh) {
    try {
      return await getDocFromCache(target)
    } catch {
      // not in the browser copy yet: ask Firebase
    }
  }
  try {
    return await getDoc(target)
  } catch (error) {
    console.warn('cloud read', error?.code ?? 'unknown')
    return getDocFromCache(target)
  }
}

// --- Conversions -----------------------------------------------------------

// Whole cents, or an error: nothing that is not a positive amount within the
// app's cap ever reaches Firestore
function toCents(amount) {
  const cents = Math.round(amount * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) {
    throw new Error(`Invalid amount: ${amount}`)
  }
  return cents
}

const centsOrNull = (amount) => (amount > 0 ? toCents(amount) : null)
const isCents = (value) => Number.isSafeInteger(value) && value > 0 && value <= MAX_CENTS
const byId = (a, b) => a.id - b.id

function transactionData(tx) {
  return {
    amountCents: toCents(tx.amount),
    currency: tx.currency,
    type: tx.type,
    categoryId: tx.categoryId ?? null,
    note: tx.note ?? '',
    date: tx.date,
    paymentMethod: normalizePaymentMethod(tx.paymentMethod),
    // only an income has a source; without one the field is left out
    ...(sourceFor(tx) && { source: sourceFor(tx) }),
  }
}

function savedTransaction(tx, id) {
  return {
    ...tx,
    note: tx.note ?? '',
    paymentMethod: normalizePaymentMethod(tx.paymentMethod),
    source: sourceFor(tx),
    id,
  }
}

function recurringData(item) {
  return {
    amountCents: toCents(item.amount),
    currency: item.currency,
    type: item.type,
    categoryId: item.categoryId ?? null,
    note: item.note ?? '',
    schedule: item.schedule,
  }
}

function savingsData(move) {
  return {
    amountCents: toCents(move.amount),
    currency: move.currency,
    direction: move.direction,
    note: move.note ?? '',
    date: move.date,
  }
}

function goalData(goal) {
  const clean = normalizeGoal(goal)
  return {
    name: clean.name,
    targetCents: toCents(clean.target),
    currency: clean.currency,
    createdAt: clean.createdAt,
    achievedAt: clean.achievedAt,
  }
}

function profileData(profile) {
  return {
    name: cleanName(profile.name),
    incomeCents: centsOrNull(profile.income),
    currency: cleanCurrency(profile.currency),
    savingsGoalCents: centsOrNull(profile.savingsGoal),
    onboardedAt: profile.onboardedAt ?? null,
  }
}

function toProfile(data) {
  if (!data) return EMPTY_PROFILE
  return {
    name: data.name ?? '',
    income: data.incomeCents ? data.incomeCents / 100 : null,
    currency: cleanCurrency(data.currency),
    savingsGoal: data.savingsGoalCents ? data.savingsGoalCents / 100 : null,
    onboardedAt: data.onboardedAt ?? null,
  }
}

// A document that does not have a valid amount (written by hand in the
// console, for example) is left out instead of breaking the totals
function withAmount(snapshot) {
  const data = snapshot.data()
  if (!isCents(data.amountCents)) return null
  return { id: Number(snapshot.id), data, amount: data.amountCents / 100 }
}

function toTransaction(snapshot) {
  const item = withAmount(snapshot)
  if (!item) return null
  const { id, data, amount } = item
  return {
    id,
    amount,
    currency: data.currency,
    type: data.type,
    categoryId: data.categoryId ?? null,
    note: data.note ?? '',
    date: data.date,
    paymentMethod: normalizePaymentMethod(data.paymentMethod),
    source: sourceFor({ type: data.type, source: data.source }),
  }
}

function toRecurring(snapshot) {
  const item = withAmount(snapshot)
  if (!item) return null
  const { id, data, amount } = item
  return {
    id,
    amount,
    currency: data.currency,
    type: data.type,
    categoryId: data.categoryId ?? null,
    note: data.note ?? '',
    schedule: data.schedule,
    lastPeriod: data.lastPeriod ?? null,
  }
}

function toSavingsMove(snapshot) {
  const item = withAmount(snapshot)
  if (!item) return null
  const { id, data, amount } = item
  return {
    id,
    amount,
    currency: data.currency,
    direction: data.direction,
    note: data.note ?? '',
    date: data.date,
  }
}

// A goal document that is not valid (written by hand in the console, for
// example) is left out instead of breaking the screens
function toGoal(snapshot) {
  const data = snapshot.data()
  if (!isCents(data.targetCents)) return null
  if (typeof data.name !== 'string') return null
  const name = data.name.trim().slice(0, MAX_GOAL_NAME_LENGTH).trim()
  if (name === '') return null
  if (data.currency !== 'CRC' && data.currency !== 'USD') return null
  if (typeof data.createdAt !== 'string' || !isValidDate(data.createdAt)) return null
  return {
    id: Number(snapshot.id),
    name,
    target: data.targetCents / 100,
    currency: data.currency,
    createdAt: data.createdAt,
    achievedAt:
      typeof data.achievedAt === 'string' && isValidDate(data.achievedAt)
        ? data.achievedAt
        : null,
  }
}

function toBudget(snapshot) {
  const data = snapshot.data()
  if (!isCents(data.amountCents)) return null
  return { categoryId: data.categoryId, currency: data.currency, amount: data.amountCents / 100 }
}

function toCategory(snapshot) {
  const data = snapshot.data()
  return { id: Number(snapshot.id), name: data.name, color: data.color }
}

const isBuiltIn = (id) => builtInCategories.some((c) => c.id === id)
const rows = (snapshot, convert) => snapshot.docs.map(convert).filter(Boolean)

async function readAll(fresh) {
  const [transactions, categories, budgets, recurring, savings, goals, profile, schedule] =
    await Promise.all([
      readList(listOf('transactions'), fresh),
      readList(listOf('categories'), fresh),
      readList(listOf('budgets'), fresh),
      readList(listOf('recurring'), fresh),
      readList(listOf('savings'), fresh),
      readList(listOf('goals'), fresh),
      readItem(metaOf('profile'), fresh),
      readItem(metaOf('schedule'), fresh),
    ])
  return {
    profile: toProfile(profile.exists() ? profile.data() : null),
    transactions: rows(transactions, toTransaction).sort(byId),
    categories: [
      ...builtInCategories,
      ...rows(categories, toCategory)
        .filter((c) => !isBuiltIn(c.id))
        .sort(byId),
    ],
    budgets: rows(budgets, toBudget).sort(
      (a, b) => a.categoryId - b.categoryId || a.currency.localeCompare(b.currency),
    ),
    recurring: rows(recurring, toRecurring).sort(byId),
    savings: rows(savings, toSavingsMove).sort(byId),
    goals: rows(goals, toGoal).sort(byId),
    quincenaSchedule: normalizeSchedule(
      schedule.exists() ? schedule.data().entries : DEFAULT_SCHEDULE,
    ),
  }
}

async function readProfile() {
  const snapshot = await readItem(metaOf('profile'), false)
  return toProfile(snapshot.exists() ? snapshot.data() : null)
}

// Writes a whole state (a backup, or the data of this device) with its own
// ids. The caller removes what was there first when it has to.
function writeState(writer, state, profile) {
  for (const { id, name, color } of state.categories.filter((c) => c.name)) {
    writer.set(itemOf('categories', id), { name, color })
  }
  for (const tx of state.transactions) {
    writer.set(itemOf('transactions', tx.id), transactionData(tx))
  }
  for (const b of state.budgets) {
    writer.set(itemOf('budgets', budgetId(b.categoryId, b.currency)), {
      categoryId: b.categoryId,
      currency: b.currency,
      amountCents: toCents(b.amount),
    })
  }
  for (const item of state.recurring) {
    writer.set(itemOf('recurring', item.id), {
      ...recurringData(item),
      lastPeriod: item.lastPeriod ?? null,
    })
  }
  for (const move of state.savings ?? []) {
    writer.set(itemOf('savings', move.id), savingsData(move))
  }
  for (const goal of state.goals ?? []) {
    writer.set(itemOf('goals', goal.id), goalData(goal))
  }
  writer.set(metaOf('schedule'), {
    entries: normalizeSchedule(state.quincenaSchedule ?? DEFAULT_SCHEDULE),
  })
  writer.set(metaOf('profile'), profileData(profile))
}

// Every document of the account, to be removed (except the ones in `keep`)
function deleteEverything(writer, current, keep = new Set()) {
  const remove = (name, id) => {
    if (!keep.has(`${name}/${id}`)) writer.delete(itemOf(name, id))
  }
  for (const tx of current.transactions) remove('transactions', tx.id)
  for (const c of current.categories.filter((c) => c.name)) remove('categories', c.id)
  for (const b of current.budgets) remove('budgets', budgetId(b.categoryId, b.currency))
  for (const item of current.recurring) remove('recurring', item.id)
  for (const move of current.savings) remove('savings', move.id)
  for (const goal of current.goals) remove('goals', goal.id)
}

// --- The operations (same names and results as storage.js) -----------------

export function loadAll() {
  return readAll(true)
}

// Replaces everything with the cleaned data of a backup
export async function restoreAll(data) {
  const current = await readAll(false)
  const keep = new Set([
    ...data.transactions.map((tx) => `transactions/${tx.id}`),
    ...data.categories.map((c) => `categories/${c.id}`),
    ...data.budgets.map((b) => `budgets/${budgetId(b.categoryId, b.currency)}`),
    ...data.recurring.map((item) => `recurring/${item.id}`),
    ...(data.savings ?? []).map((move) => `savings/${move.id}`),
    ...(data.goals ?? []).map((goal) => `goals/${goal.id}`),
  ])
  const writer = newWriter()
  deleteEverything(writer, current, keep)
  // a backup without a profile (an older one) keeps the current one; in any
  // case the person has data now, so the welcome is done
  writeState(writer, data, {
    ...current.profile,
    ...data.profile,
    onboardedAt: current.profile.onboardedAt ?? todayString(),
  })
  await writer.commit()
  return readAll(false)
}

// The data of this device (from SQLite), the first time an account takes it.
// It keeps its ids, so doing it again overwrites instead of duplicating.
export async function uploadLocalData(state) {
  const writer = newWriter()
  writeState(writer, state, state.profile ?? EMPTY_PROFILE)
  await writer.commit()
  return readAll(false)
}

export async function insertTransaction(tx) {
  const id = newId()
  const writer = newWriter()
  writer.set(itemOf('transactions', id), transactionData(tx))
  await writer.commit()
  return savedTransaction(tx, id)
}

export async function insertTransactions(list) {
  const writer = newWriter()
  const saved = list.map((tx) => {
    const id = newId()
    writer.set(itemOf('transactions', id), transactionData(tx))
    return savedTransaction(tx, id)
  })
  await writer.commit()
  return saved
}

export async function updateTransaction(id, tx) {
  const writer = newWriter()
  writer.set(itemOf('transactions', id), transactionData(tx))
  await writer.commit()
  return savedTransaction(tx, id)
}

export async function deleteTransaction(id) {
  const writer = newWriter()
  writer.delete(itemOf('transactions', id))
  await writer.commit()
}

export async function insertCategory({ name, color }) {
  const id = newId()
  const writer = newWriter()
  writer.set(itemOf('categories', id), { name, color })
  await writer.commit()
  return { id, name, color }
}

// Built-in categories are never changed
export async function updateCategory(id, { name, color }) {
  if (!isBuiltIn(id)) {
    const writer = newWriter()
    writer.set(itemOf('categories', id), { name, color })
    await writer.commit()
  }
  return { id, name, color }
}

// Its transactions and recurring items move to another category first
export async function deleteCategory(id, moveToId) {
  if (isBuiltIn(id)) return
  const [transactions, recurring] = await Promise.all([
    readList(query(listOf('transactions'), where('categoryId', '==', id)), false),
    readList(query(listOf('recurring'), where('categoryId', '==', id)), false),
  ])
  const writer = newWriter()
  for (const snapshot of transactions.docs) {
    writer.update(snapshot.ref, { categoryId: moveToId })
  }
  for (const snapshot of recurring.docs) {
    writer.update(snapshot.ref, { categoryId: moveToId })
  }
  writer.delete(itemOf('categories', id))
  await writer.commit()
}

export async function clearAll() {
  const current = await readAll(false)
  const writer = newWriter()
  deleteEverything(writer, current)
  // back to 15/30 and to a person who has not seen the welcome
  writer.set(metaOf('schedule'), { entries: DEFAULT_SCHEDULE })
  writer.set(metaOf('profile'), profileData(EMPTY_PROFILE))
  await writer.commit()
}

// An amount of 0 (or none) removes the budget; returns the saved budget or null
export async function setBudget(categoryId, currency, amount) {
  const writer = newWriter()
  const target = itemOf('budgets', budgetId(categoryId, currency))
  if (amount > 0) {
    writer.set(target, { categoryId, currency, amountCents: toCents(amount) })
    await writer.commit()
    return { categoryId, currency, amount }
  }
  writer.delete(target)
  await writer.commit()
  return null
}

export async function insertRecurring(item) {
  const id = newId()
  const writer = newWriter()
  writer.set(itemOf('recurring', id), { ...recurringData(item), lastPeriod: null })
  await writer.commit()
  return { ...item, note: item.note ?? '', id, lastPeriod: null }
}

// lastPeriod is not touched here: only confirm and skip change it
export async function updateRecurring(id, item) {
  const writer = newWriter()
  writer.update(itemOf('recurring', id), recurringData(item))
  await writer.commit()
  return { ...item, note: item.note ?? '', id }
}

export async function deleteRecurring(id) {
  const writer = newWriter()
  writer.delete(itemOf('recurring', id))
  await writer.commit()
}

export async function skipRecurring(id, period) {
  const writer = newWriter()
  writer.update(itemOf('recurring', id), { lastPeriod: period })
  await writer.commit()
}

// Adds the transaction and marks the item as handled, both or neither
export async function confirmRecurring(id, period, tx) {
  const txId = newId()
  const writer = newWriter()
  writer.set(itemOf('transactions', txId), transactionData(tx))
  writer.update(itemOf('recurring', id), { lastPeriod: period })
  await writer.commit()
  return savedTransaction(tx, txId)
}

// The id of a savings move or a goal: the one its caller made for this
// action (lib/ids.js), or a new one. Because the document is named by the id,
// saving the same action again (a retry) overwrites it instead of adding a
// second one.
function idOf(item, label) {
  if (item.id === undefined || item.id === null) return newId()
  if (!Number.isSafeInteger(item.id) || item.id <= 0) {
    throw new Error(`Invalid ${label} id: ${item.id}`)
  }
  return item.id
}

// Marks the goals a deposit reached, in the same batch as the deposit
function markReached(writer, move, options) {
  if (move.direction !== 'in') return []
  const achievedAt = options.achievedAt ?? todayString()
  const ids = options.achieveGoalIds ?? []
  for (const goalId of ids) {
    writer.update(itemOf('goals', goalId), { achievedAt })
  }
  return ids
}

// Saves a savings move and the goals it reached in ONE batch.
//   options: { achieveGoalIds, achievedAt, awaitServer }
// Returns { move, status, achievedGoalIds }. status is 'confirmed' once Google
// answered ok, or 'pending' when it had not answered after WRITE_WAIT_MS
// (CONFIRM_WAIT_MS with awaitServer: true): the write stays queued and syncs
// later. A refusal in time rejects.
export async function saveSavingsMove(move, options = {}) {
  const id = idOf(move, 'savings move')
  const writer = newWriter()
  writer.set(itemOf('savings', id), savingsData(move))
  const achievedGoalIds = markReached(writer, move, options)
  const status = await writer.commit(options)
  return { move: { ...move, note: move.note ?? '', id }, status, achievedGoalIds }
}

// Same as saveSavingsMove, returning only the saved move
export async function insertSavingsMove(move, options = {}) {
  return (await saveSavingsMove(move, options)).move
}

export async function deleteSavingsMove(id) {
  const writer = newWriter()
  writer.delete(itemOf('savings', id))
  await writer.commit()
}

// Adds an income and the part of it sent to savings, both or neither (and the
// goals the deposit reached, see saveSavingsMove).
// Returns { transaction, move, status, achievedGoalIds }.
export async function insertIncomeWithSavings(tx, move, options = {}) {
  const txId = newId()
  const moveId = idOf(move, 'savings move')
  const writer = newWriter()
  writer.set(itemOf('transactions', txId), transactionData(tx))
  writer.set(itemOf('savings', moveId), savingsData(move))
  const achievedGoalIds = markReached(writer, move, options)
  const status = await writer.commit(options)
  return {
    transaction: savedTransaction(tx, txId),
    move: { ...move, note: move.note ?? '', id: moveId },
    status,
    achievedGoalIds,
  }
}

// --- Savings goals ---------------------------------------------------------
// Each returns { goal, status } (status as in saveSavingsMove; the optional
// { awaitServer: true } waits for Google longer).

export async function insertGoal(goal, options = {}) {
  const id = idOf(goal, 'goal')
  const writer = newWriter()
  writer.set(itemOf('goals', id), goalData(goal))
  const status = await writer.commit(options)
  return { goal: { ...normalizeGoal({ ...goal, id: undefined }), id }, status }
}

// Replaces the whole goal (name, target, currency and the two dates)
export async function updateGoal(id, goal, options = {}) {
  const writer = newWriter()
  writer.update(itemOf('goals', id), goalData(goal))
  const status = await writer.commit(options)
  return { goal: { ...normalizeGoal({ ...goal, id: undefined }), id }, status }
}

export async function deleteGoal(id) {
  const writer = newWriter()
  writer.delete(itemOf('goals', id))
  await writer.commit()
}


export async function saveQuincenaSchedule(schedule) {
  const entries = normalizeSchedule(schedule)
  const writer = newWriter()
  writer.set(metaOf('schedule'), { entries })
  await writer.commit()
  return entries
}

// Finishes the welcome, all of it or none of it (see storage.js)
export async function completeOnboarding({
  profile,
  schedule = null,
  add = [],
  update = null,
}) {
  const current = await readAll(false)
  // the item was deleted meanwhile: fail instead of reporting a save
  if (update && !current.recurring.some((item) => item.id === update.id)) {
    throw new Error(`Recurring item not found: ${update.id}`)
  }
  const writer = newWriter()
  if (schedule) {
    writer.set(metaOf('schedule'), { entries: normalizeSchedule(schedule) })
  }
  // an expense with a `newCategory` name creates it (or finds the one that
  // already has that name)
  const known = [...current.categories]
  for (const original of add) {
    let item = original
    if (original.newCategory) {
      let category = findCategoryByName(known, original.newCategory)
      if (!category) {
        const color = customColorAt(known.filter((c) => c.name).length)
        category = { id: newId(), name: original.newCategory, color }
        writer.set(itemOf('categories', category.id), {
          name: category.name,
          color,
        })
        known.push(category)
      }
      item = { ...original, categoryId: category.id }
    }
    writer.set(itemOf('recurring', newId()), { ...recurringData(item), lastPeriod: null })
  }
  if (update) {
    writer.update(itemOf('recurring', update.id), recurringData(update.item))
  }
  writer.set(metaOf('profile'), profileData({ ...profile, onboardedAt: todayString() }))
  await writer.commit()
  return readAll(false)
}

// Skips the welcome (or changes nothing in a repeat): only the date is saved
export async function skipOnboarding() {
  const after = { ...(await readProfile()), onboardedAt: todayString() }
  const writer = newWriter()
  writer.set(metaOf('profile'), profileData(after))
  await writer.commit()
  return toProfile(profileData(after))
}

// Settings: the name shown on Home ('' removes it)
export async function saveProfileName(name) {
  const after = { ...(await readProfile()), name: cleanName(name) }
  const writer = newWriter()
  writer.set(metaOf('profile'), profileData(after))
  await writer.commit()
  return toProfile(profileData(after))
}
