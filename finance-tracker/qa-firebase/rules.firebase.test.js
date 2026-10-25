import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import {
  budgetData,
  categoryData,
  goalData,
  newRecurringData,
  profileData,
  recurringData,
  savingsData,
  scheduleData,
  transactionData,
} from '../src/db/cloudData.js'
import { EMPTY_PROFILE } from '../src/lib/onboarding.js'
import { DEFAULT_SCHEDULE } from '../src/lib/quincenaSchedule.js'
import { QaGuardError, describeConfig, readQaConfig } from './lib/env.js'
import * as tracker from './lib/tracker.js'
import { makeClient, taggedDocs, teardown } from './lib/sdk.js'

// Rules tests against the REAL Firestore of the test project, with real
// signed-in test accounts (see docs/qa/firebase-real.md). Every document is
// written under the signed-in user's own users/{uid}/ path, has a numeric id
// built from the run id, carries the tag "QA-<runId>" (budgets have no text
// field: their id starts with the run's id prefix) and is removed at the end
// by teardown. Each write ATTEMPT is counted against QA_MAX_WRITES, also the
// ones the rules refuse.
//
// Port of the emulator list E1-E20 of docs/qa/revision-seguridad-firebase.md
// to the real project (only what is safe to do there). The documents that must
// be accepted are built with the SAME functions the app uses (src/db/cloudData.js),
// so they follow the app; the ones that must be refused are those documents with
// one thing broken. The rules are firestore.rules (ficha 007); the offline test
// src/db/firestoreRules.test.js keeps them in step with the app.

let cfg
let A
let B
let anon
const today = new Date().toISOString().slice(0, 10)

beforeAll(async () => {
  try {
    cfg = readQaConfig()
  } catch (error) {
    if (error instanceof QaGuardError) throw new Error(`REFUSED: ${error.message}`, { cause: error })
    throw error
  }
  console.log(`\n${describeConfig(cfg)}`)
  tracker.initRun(cfg)
  A = await makeClient(cfg, cfg.account(1))
  B = await makeClient(cfg, cfg.account(2))
  anon = await makeClient(cfg, null)
  expect(A.uid).not.toBe(B.uid)
})

afterAll(async () => {
  if (cfg) {
    const result = await teardown(cfg)
    const state = tracker.snapshot()
    console.log(`Writes used this run: ${state?.writes} of ${cfg.maxWrites}`)
    expect(result.failures, 'teardown failures').toEqual([])
  }
  await Promise.all([A?.close(), B?.close(), anon?.close()])
})

// --- helpers ---------------------------------------------------------------

const note = (label) => `${cfg.tag} ${label}`

// A valid transaction as the app writes it (amount 123.45), with changes
function tx(label, extra = {}) {
  return {
    ...transactionData({
      amount: 123.45,
      currency: 'CRC',
      type: 'expense',
      categoryId: null,
      note: note(label),
      date: today,
      paymentMethod: 'cash',
    }),
    ...extra,
  }
}

// The other documents as the app writes them; `change` is merged into the
// app-side object first (so it goes through the builder, like in the app)
const appTx = (label, change = {}) =>
  transactionData({
    amount: 123.45,
    currency: 'CRC',
    type: 'expense',
    categoryId: null,
    note: note(label),
    date: today,
    paymentMethod: 'card',
    ...change,
  })
const appSaving = (label, change = {}) =>
  savingsData({ amount: 50, currency: 'USD', direction: 'in', note: note(label), date: today, ...change })
const appRecurring = (label, change = {}) =>
  newRecurringData({
    amount: 40,
    currency: 'USD',
    type: 'expense',
    categoryId: null,
    note: note(label),
    schedule: 'every',
    ...change,
  })
const appGoal = (label, change = {}) =>
  goalData({ name: note(label), target: 500, currency: 'CRC', createdAt: today, achievedAt: null, ...change })
const appCategory = (label, change = {}) => categoryData({ name: note(label), color: 'blue', ...change })

// A counted, tracked write by `client` into the path of `owner`
// (owner defaults to the writer). Registered before the call.
async function put(client, name, id, data, owner = client) {
  tracker.countWrites(cfg.runId, 1)
  tracker.track(cfg.runId, owner.n, name, id)
  await setDoc(doc(client.db, 'users', owner.uid, name, String(id)), data)
}

const refOf = (client, name, id, owner = client) => doc(client.db, 'users', owner.uid, name, String(id))

async function denied(promise) {
  let error = null
  try {
    await promise
  } catch (e) {
    error = e
  }
  expect(error, 'the operation should have been rejected').not.toBeNull()
  expect(error.code).toBe('permission-denied')
}

// A write that the rules must refuse: counted and registered first (like put),
// so that if it ever got in, teardown removes it
async function refuse(client, name, id, data) {
  tracker.countWrites(cfg.runId, 1)
  tracker.track(cfg.runId, client.n, name, id)
  await denied(setDoc(refOf(client, name, id), data))
}

const newId = () => tracker.newDocId(cfg.runId)

// --- 1. the owner has full access to its own space -------------------------

describe('owner: create, read, update, delete in every collection', () => {
  // [collection, document as the app writes it, a partial update that stays valid]
  const cases = [
    ['transactions', () => appTx('own tx'), { amountCents: 99900 }],
    ['savings', () => appSaving('own saving'), { amountCents: 7000 }],
    // the document is named <categoryId>_<currency>
    ['budgets', (base) => budgetData(Number(base), 'CRC', 20000), { amountCents: 3000000 }],
    ['recurring', () => appRecurring('own recurring'), { lastPeriod: '2026-10-1' }],
    ['categories', () => appCategory('cat'), { color: 'lime' }],
    ['goals', () => appGoal('own goal'), { achievedAt: today }],
    // meta/profile and meta/schedule have their own tests (section 8)
  ]

  test.each(cases)('%s', async (name, build, changes) => {
    const base = String(await newId())
    const id = name === 'budgets' ? `${base}_CRC` : base
    const data = build(base)
    await put(A, name, id, data) // create
    let snap = await getDocFromServer(refOf(A, name, id)) // read
    expect(snap.exists()).toBe(true)
    expect(snap.data()).toEqual(data)

    tracker.countWrites(cfg.runId, 1)
    await updateDoc(refOf(A, name, id), changes) // update
    snap = await getDocFromServer(refOf(A, name, id))
    expect(snap.data()).toEqual({ ...data, ...changes })

    tracker.countWrites(cfg.runId, 1)
    await deleteDoc(refOf(A, name, id)) // delete
    snap = await getDocFromServer(refOf(A, name, id))
    expect(snap.exists()).toBe(false)
  })
})

describe('persistence: the server keeps what was written', () => {
  test('write, re-read, update, re-read, delete, re-read (not found)', async () => {
    const id = await newId()
    const data = tx('persist')
    await put(A, 'transactions', id, data)
    let snap = await getDocFromServer(refOf(A, 'transactions', id))
    expect(snap.data().amountCents).toBe(12345)

    tracker.countWrites(cfg.runId, 1)
    await updateDoc(refOf(A, 'transactions', id), { amountCents: 54321, note: note('persist edited') })
    snap = await getDocFromServer(refOf(A, 'transactions', id))
    expect(snap.data()).toMatchObject({ amountCents: 54321, note: note('persist edited') })

    // a new client of the same account (a different "device") sees it too
    const other = await makeClient(cfg, cfg.account(1))
    try {
      const again = await getDocFromServer(doc(other.db, 'users', other.uid, 'transactions', String(id)))
      expect(again.data().amountCents).toBe(54321)
    } finally {
      await other.close()
    }

    tracker.countWrites(cfg.runId, 1)
    await deleteDoc(refOf(A, 'transactions', id))
    snap = await getDocFromServer(refOf(A, 'transactions', id))
    expect(snap.exists()).toBe(false)
  })
})

// --- 2. no access between accounts -----------------------------------------

describe('account B cannot reach account A', () => {
  let victimId
  let victimData

  beforeAll(async () => {
    victimId = await newId()
    victimData = tx('victim of B')
    await put(A, 'transactions', victimId, victimData)
  })

  const collA = (name) => collection(B.db, 'users', A.uid, name)

  test('B cannot read A document', async () => {
    await denied(getDocFromServer(refOf(B, 'transactions', victimId, A)))
  })

  test('B cannot list A collections', async () => {
    for (const name of ['transactions', 'savings', 'budgets', 'recurring', 'categories', 'goals', 'meta']) {
      await denied(getDocsFromServer(collA(name)))
    }
  })

  test('B cannot query A data with a filter either', async () => {
    await denied(getDocsFromServer(query(collA('transactions'), where('note', '>=', cfg.tag))))
  })

  test('B cannot list across users with a collection-group query', async () => {
    await denied(getDocsFromServer(query(collectionGroup(B.db, 'transactions'), where('note', '>=', cfg.tag))))
  })

  test('B cannot overwrite, update or delete A document', async () => {
    tracker.countWrites(cfg.runId, 3)
    await denied(setDoc(refOf(B, 'transactions', victimId, A), tx('B takeover', { amountCents: 1 })))
    await denied(updateDoc(refOf(B, 'transactions', victimId, A), { amountCents: 1 }))
    await denied(deleteDoc(refOf(B, 'transactions', victimId, A)))
  })

  test('B cannot create new documents in A space (faked uid in the path)', async () => {
    const id = await newId()
    tracker.track(cfg.runId, A.n, 'transactions', id) // would be removed by A if it ever got in
    tracker.countWrites(cfg.runId, 1)
    await denied(setDoc(refOf(B, 'transactions', id, A), tx('B injected')))
  })

  test('A document is unchanged afterwards', async () => {
    const snap = await getDocFromServer(refOf(A, 'transactions', victimId))
    expect(snap.exists()).toBe(true)
    expect(snap.data()).toEqual(victimData)
  })

  test('B still has its own space (not locked out by the denials)', async () => {
    const id = await newId()
    await put(B, 'transactions', id, tx('B own'))
    const snap = await getDocFromServer(refOf(B, 'transactions', id))
    expect(snap.data().note).toBe(note('B own'))
    // and A cannot see it
    await denied(getDocFromServer(refOf(A, 'transactions', id, B)))
  })
})

// --- 3. not signed in --------------------------------------------------------

describe('not signed in', () => {
  test('cannot read any path', async () => {
    const paths = [
      ['users', A.uid, 'transactions', '1'],
      ['users', A.uid, 'meta', 'profile'],
      ['users', A.uid],
      ['somewhere', 'else'],
    ]
    for (const p of paths) await denied(getDocFromServer(doc(anon.db, ...p)))
    await denied(getDocsFromServer(collection(anon.db, 'users', A.uid, 'transactions')))
    await denied(getDocsFromServer(collection(anon.db, 'users')))
  })

  test('cannot write any path', async () => {
    const id = await newId()
    tracker.track(cfg.runId, 1, 'transactions', id)
    tracker.countWrites(cfg.runId, 2)
    await denied(setDoc(doc(anon.db, 'users', A.uid, 'transactions', id), tx('anon')))
    await denied(setDoc(doc(anon.db, 'qa_open', id), { qaTag: note('anon root') }))
  })
})

// --- 4. paths outside the allowlist -------------------------------------------

describe('paths outside the allowlist are denied', () => {
  test('users/{uid} document itself', async () => {
    tracker.countWrites(cfg.runId, 1)
    const ref = doc(A.db, 'users', A.uid)
    try {
      await denied(setDoc(ref, { qaTag: note('user doc') }))
    } finally {
      // only if the rules were wrong and let it in: remove what we wrote
      try {
        const snap = await getDocFromServer(ref)
        if (snap.exists() && snap.data().qaTag?.startsWith(cfg.tag)) await deleteDoc(ref)
      } catch {
        // denied, as expected
      }
    }
    await denied(getDocFromServer(ref))
  })

  test('a collection that is not in the list', async () => {
    const id = await newId()
    tracker.track(cfg.runId, 1, 'notAllowed', id)
    tracker.countWrites(cfg.runId, 1)
    await denied(setDoc(doc(A.db, 'users', A.uid, 'notAllowed', id), { qaTag: note('other list') }))
  })

  test('deeper paths (sub-collections)', async () => {
    const id = await newId()
    tracker.track(cfg.runId, 1, `transactions/${id}/sub`, 'x')
    tracker.countWrites(cfg.runId, 1)
    await denied(setDoc(doc(A.db, 'users', A.uid, 'transactions', id, 'sub', 'x'), { qaTag: note('deep') }))
  })

  test('a root collection', async () => {
    const id = await newId()
    tracker.countWrites(cfg.runId, 1)
    await denied(setDoc(doc(A.db, 'qa_root', id), { qaTag: note('root') }))
    await denied(getDocsFromServer(collection(A.db, 'qa_root')))
  })

  test('another uid, even an invented one', async () => {
    const id = await newId()
    tracker.countWrites(cfg.runId, 1)
    await denied(setDoc(doc(A.db, 'users', 'qa-not-a-real-uid', 'transactions', id), tx('fake uid')))
  })

  test('a collection-group query by the owner', async () => {
    await denied(getDocsFromServer(query(collectionGroup(A.db, 'transactions'), where('note', '>=', cfg.tag))))
  })
})

// --- 6. currency separation and decimal accuracy ----------------------------------

describe('amounts are exact whole cents and currencies stay apart', () => {
  test('100 x $0.10 add up to exactly 1000 cents', async () => {
    tracker.countWrites(cfg.runId, 100)
    const label = 'cents10'
    for (let i = 0; i < 100; i += 2) {
      const batch = writeBatch(A.db)
      for (let k = 0; k < 2; k++) {
        const id = await newId()
        tracker.track(cfg.runId, 1, 'transactions', id)
        batch.set(refOf(A, 'transactions', id), tx(`${label} ${i + k}`, { amountCents: 10, currency: 'USD' }))
      }
      await batch.commit()
    }
    const docs = await taggedDocs(A, 'transactions', note(label))
    expect(docs).toHaveLength(100)
    expect(docs.every((d) => d.currency === 'USD' && d.amountCents === 10)).toBe(true)
    expect(docs.reduce((sum, d) => sum + d.amountCents, 0)).toBe(1000)
  })

  test('₡10.000 and $100 are stored and read back separately', async () => {
    const crc = await newId()
    const usd = await newId()
    await put(A, 'transactions', crc, tx('money crc', { amountCents: 1_000_000, currency: 'CRC' }))
    await put(A, 'transactions', usd, tx('money usd', { amountCents: 10_000, currency: 'USD' }))
    const docs = await taggedDocs(A, 'transactions', note('money'))
    expect(docs).toHaveLength(2)
    const by = (code) => docs.filter((d) => d.currency === code)
    expect(by('CRC').map((d) => d.amountCents)).toEqual([1_000_000])
    expect(by('USD').map((d) => d.amountCents)).toEqual([10_000])
    const total = (code) => by(code).reduce((s, d) => s + d.amountCents, 0)
    expect(total('CRC') / 100).toBe(10000)
    expect(total('USD') / 100).toBe(100)
  })

  test('the same id written twice leaves one document', async () => {
    const id = await newId()
    const data = tx('dup')
    await put(A, 'transactions', id, data)
    await put(A, 'transactions', id, data)
    const docs = await taggedDocs(A, 'transactions', note('dup'))
    expect(docs).toHaveLength(1)
    expect(docs[0].id).toBe(String(id))
  })
})

// --- 7. the hardened rules: invalid documents are refused -------------------------

// Cases: [what is wrong, function that breaks a valid document]. The valid
// document is the one the app writes; each case breaks one thing. A refused
// write is the expected result, so there is nothing to clean up.
const long = (n) => `${cfg.tag} ${'x'.repeat(n)}`
const without = (key) => (d) => {
  const copy = { ...d }
  delete copy[key]
  return copy
}
const set = (changes) => (d) => ({ ...d, ...changes })

const NEGATIVE = {
  transactions: {
    base: () => appTx('neg'),
    cases: [
      ['amountCents 0', set({ amountCents: 0 })],
      ['amountCents negative', set({ amountCents: -500 })],
      ['amountCents with decimals', set({ amountCents: 12.5 })],
      ['amountCents as a string', set({ amountCents: '500' })],
      ['amountCents over the cap (1e11 + 1)', set({ amountCents: 100000000001 })],
      ['unknown currency (EUR)', set({ currency: 'EUR' })],
      ['unknown type', set({ type: 'transfer' })],
      ['date without zeros', set({ date: '2026-1-5' })],
      ['date before 2000', set({ date: '1999-12-31' })],
      ['note over the limit (200 characters)', (d) => ({ ...d, note: long(200) })],
      ['unknown payment method', set({ paymentMethod: 'bitcoin' })],
      ['categoryId as text', set({ categoryId: '7' })],
      ['source on an expense', set({ source: 'salary' })],
      ['unknown source on an income', set({ type: 'income', source: 'lottery' })],
      ['extra fields', (d) => ({ ...d, admin: true, qaTag: note('extra') })],
      ['missing note', without('note')],
      ['missing amountCents', without('amountCents')],
    ],
  },
  savings: {
    base: () => appSaving('neg'),
    cases: [
      ['amountCents 0', set({ amountCents: 0 })],
      ['unknown currency', set({ currency: 'EUR' })],
      ['unknown direction', set({ direction: 'sideways' })],
      ['date that is not a date', set({ date: 'hola' })],
      ['note over the limit', (d) => ({ ...d, note: long(200) })],
      ['extra fields', (d) => ({ ...d, admin: true, qaTag: note('extra') })],
      ['missing direction', without('direction')],
    ],
  },
  recurring: {
    base: () => appRecurring('neg'),
    cases: [
      ['unknown schedule', set({ schedule: 'weekly' })],
      ['lastPeriod that is not a period', set({ lastPeriod: 'hola' })],
      ['amountCents with decimals', set({ amountCents: 1.5 })],
      ['extra fields', (d) => ({ ...d, admin: true, qaTag: note('extra') })],
      ['missing lastPeriod', without('lastPeriod')],
    ],
  },
  categories: {
    base: () => appCategory('neg'),
    cases: [
      ['empty name', set({ name: '' })],
      ['name over the limit (60 characters)', (d) => ({ ...d, name: long(60) })],
      ['unknown color', set({ color: 'rojo' })],
      ['extra fields', (d) => ({ ...d, admin: true, qaTag: note('extra') })],
    ],
  },
  goals: {
    base: () => appGoal('neg'),
    cases: [
      ['empty name', set({ name: '' })],
      ['name over the limit (41 characters)', (d) => ({ ...d, name: long(41) })],
      ['targetCents 0', set({ targetCents: 0 })],
      ['unknown currency', set({ currency: 'EUR' })],
      ['achievedAt that is not a date', set({ achievedAt: 'hola' })],
      ['extra fields', (d) => ({ ...d, admin: true, qaTag: note('extra') })],
      ['missing createdAt', without('createdAt')],
    ],
  },
}

describe.each(Object.entries(NEGATIVE))('%s: invalid documents are refused', (name, { base, cases }) => {
  test.each(cases)('%s', async (_what, change) => {
    await refuse(A, name, await newId(), change(base()))
  })
})

describe('invalid document names and budgets are refused', () => {
  test('a transaction whose name is not a number', async () => {
    await refuse(A, 'transactions', `${await newId()}x`, appTx('neg id'))
  })

  const budgetCases = [
    ['amountCents 0', (c) => [`${c}_CRC`, { ...budgetData(c, 'CRC', 100), amountCents: 0 }]],
    ['unknown currency', (c) => [`${c}_CRC`, { ...budgetData(c, 'CRC', 100), currency: 'EUR' }]],
    ['the name says another currency', (c) => [`${c}_USD`, budgetData(c, 'CRC', 100)]],
    ['a name that is not <category>_<currency>', (c) => [`${c}x_CRC`, budgetData(c, 'CRC', 100)]],
    ['categoryId as text', (c) => [`${c}_CRC`, { ...budgetData(c, 'CRC', 100), categoryId: String(c) }]],
    ['extra fields', (c) => [`${c}_CRC`, { ...budgetData(c, 'CRC', 100), admin: true, qaTag: note('extra') }]],
  ]

  test.each(budgetCases)('budget: %s', async (_what, build) => {
    const category = Number(await newId())
    const [id, data] = build(category)
    await refuse(A, 'budgets', id, data)
  })
})

// --- 8. meta/profile and meta/schedule: the two settings documents -------------------

// These are the account's real settings (the app writes them on the first
// sign-in), so the suite reads both first, tracks them, and puts them back as
// they were (or deletes them if they did not exist) at the end. Use the
// dedicated test accounts, as for all the suite.
describe('meta: profile and schedule', () => {
  const originals = {}
  const profileOf = (change) =>
    profileData({ ...EMPTY_PROFILE, name: cfg.tag, currency: 'CRC', ...change })

  beforeAll(async () => {
    for (const name of ['profile', 'schedule']) {
      const snap = await getDocFromServer(refOf(A, 'meta', name))
      originals[name] = snap.exists() ? snap.data() : null
      tracker.track(cfg.runId, A.n, 'meta', name)
    }
  })

  afterAll(async () => {
    for (const name of ['profile', 'schedule']) {
      try {
        tracker.countWrites(cfg.runId, 1)
        if (originals[name]) await setDoc(refOf(A, 'meta', name), originals[name])
        else await deleteDoc(refOf(A, 'meta', name))
        tracker.untrack(cfg.runId, A.n, 'meta', name)
      } catch (error) {
        // teardown removes it if it still carries the tag
        console.log(`Could not put meta/${name} back as it was: ${error?.code ?? error?.message}`)
      }
    }
  })

  test('profile: a typical one, one without amounts (the welcome skipped) and a partial update', async () => {
    const typical = profileOf({ income: 250000, savingsGoal: 50000, onboardedAt: today })
    tracker.countWrites(cfg.runId, 3)
    await setDoc(refOf(A, 'meta', 'profile'), typical)
    expect((await getDocFromServer(refOf(A, 'meta', 'profile'))).data()).toEqual(typical)

    const empty = profileOf({})
    expect(empty.incomeCents).toBeNull()
    await setDoc(refOf(A, 'meta', 'profile'), empty)
    expect((await getDocFromServer(refOf(A, 'meta', 'profile'))).data()).toEqual(empty)

    await updateDoc(refOf(A, 'meta', 'profile'), { incomeCents: 300000 })
    expect((await getDocFromServer(refOf(A, 'meta', 'profile'))).data().incomeCents).toBe(300000)
  })

  test('schedule: 15/30, pay days and a manual one', async () => {
    tracker.countWrites(cfg.runId, 2)
    const fixed = scheduleData(DEFAULT_SCHEDULE)
    await setDoc(refOf(A, 'meta', 'schedule'), fixed)
    expect((await getDocFromServer(refOf(A, 'meta', 'schedule'))).data()).toEqual(fixed)

    const several = scheduleData([
      { from: '2026-01-01', mode: 'paydays', day1: 5, day2: 20 },
      { from: '2026-06-01', mode: 'paydays', day1: 10, day2: null },
      { from: '2026-09-15', mode: 'manual' },
    ])
    await setDoc(refOf(A, 'meta', 'schedule'), several)
    expect((await getDocFromServer(refOf(A, 'meta', 'schedule'))).data()).toEqual(several)
  })

  const profileCases = [
    ['name over 30 characters', () => profileOf({ name: long(30) })],
    ['incomeCents 0', () => ({ ...profileOf({}), incomeCents: 0 })],
    ['unknown currency', () => ({ ...profileOf({}), currency: 'EUR' })],
    ['onboardedAt that is not a date', () => ({ ...profileOf({}), onboardedAt: 'ayer' })],
    ['extra fields', () => ({ ...profileOf({}), admin: true })],
    ['missing name', () => without('name')(profileOf({}))],
  ]

  test.each(profileCases)('profile refused: %s', async (_what, build) => {
    tracker.countWrites(cfg.runId, 1)
    await denied(setDoc(refOf(A, 'meta', 'profile'), build()))
  })

  const scheduleCases = [
    ['no entries', () => ({ entries: [] })],
    ['entries that is not a list', () => ({ entries: 'every day' })],
    ['201 entries', () => ({ entries: Array.from({ length: 201 }, () => scheduleData(DEFAULT_SCHEDULE).entries[0]) })],
    ['an entry with an unknown mode', () => ({ entries: [{ ...scheduleData(DEFAULT_SCHEDULE).entries[0], mode: 'weekly' }] })],
    ['extra fields', () => ({ ...scheduleData(DEFAULT_SCHEDULE), admin: true })],
  ]

  test.each(scheduleCases)('schedule refused: %s', async (_what, build) => {
    tracker.countWrites(cfg.runId, 1)
    await denied(setDoc(refOf(A, 'meta', 'schedule'), build()))
  })

  test('another document in meta is refused', async () => {
    const id = `qa-${cfg.runId}`
    tracker.track(cfg.runId, A.n, 'meta', id)
    tracker.countWrites(cfg.runId, 1)
    await denied(setDoc(refOf(A, 'meta', id), profileOf({})))
  })
})

// --- 9. what the app does, replayed: it must keep working ------------------------------

describe('the operations of the app pass the rules', () => {
  test('an income with a savings deposit that reaches a goal (one batch), then edits', async () => {
    const goalId = await newId()
    const txId = await newId()
    const moveId = await newId()
    await put(A, 'goals', goalId, appGoal('goal reached'))
    tracker.countWrites(cfg.runId, 3)
    tracker.track(cfg.runId, A.n, 'transactions', txId)
    tracker.track(cfg.runId, A.n, 'savings', moveId)
    const batch = writeBatch(A.db)
    batch.set(
      refOf(A, 'transactions', txId),
      appTx('income', { type: 'income', source: 'salary', paymentMethod: 'sinpe' }),
    )
    batch.set(refOf(A, 'savings', moveId), appSaving('deposit'))
    batch.update(refOf(A, 'goals', goalId), { achievedAt: today })
    await batch.commit()
    expect((await getDocFromServer(refOf(A, 'goals', goalId))).data().achievedAt).toBe(today)
    expect((await getDocFromServer(refOf(A, 'transactions', txId))).data().source).toBe('salary')

    // a partial update that would leave an invalid document is refused
    tracker.countWrites(cfg.runId, 2)
    await denied(updateDoc(refOf(A, 'transactions', txId), { amountCents: -1 }))
    await denied(updateDoc(refOf(A, 'goals', goalId), { achievedAt: 'x' }))

    // editing a movement writes the whole document again (here as an expense,
    // so without the source)
    tracker.countWrites(cfg.runId, 1)
    await setDoc(refOf(A, 'transactions', txId), appTx('income edited'))
    const edited = (await getDocFromServer(refOf(A, 'transactions', txId))).data()
    expect('source' in edited).toBe(false)
  })

  test('a recurring item: confirm (movement + lastPeriod in one batch), skip, edit', async () => {
    const recId = await newId()
    const txId = await newId()
    await put(A, 'recurring', recId, appRecurring('rec'))
    tracker.countWrites(cfg.runId, 2)
    tracker.track(cfg.runId, A.n, 'transactions', txId)
    const batch = writeBatch(A.db)
    batch.set(refOf(A, 'transactions', txId), appTx('confirmed'))
    batch.update(refOf(A, 'recurring', recId), { lastPeriod: '2026-10-2' })
    await batch.commit()
    expect((await getDocFromServer(refOf(A, 'recurring', recId))).data().lastPeriod).toBe('2026-10-2')

    // with other pay days the period is the date the quincena started
    tracker.countWrites(cfg.runId, 2)
    await updateDoc(refOf(A, 'recurring', recId), { lastPeriod: '2026-10-25' })
    // editing the item writes its fields and leaves lastPeriod alone
    await updateDoc(
      refOf(A, 'recurring', recId),
      recurringData({
        amount: 55,
        currency: 'CRC',
        type: 'income',
        categoryId: null,
        note: note('rec edited'),
        schedule: 'second',
      }),
    )
    const after = (await getDocFromServer(refOf(A, 'recurring', recId))).data()
    expect(after).toMatchObject({ lastPeriod: '2026-10-25', schedule: 'second', amountCents: 5500 })

    tracker.countWrites(cfg.runId, 1)
    await denied(updateDoc(refOf(A, 'recurring', recId), { lastPeriod: 'hola' }))
  })

  test('deleting a category moves its movements and removes its budgets (one batch)', async () => {
    const category = await newId()
    const txId = await newId()
    await put(A, 'categories', category, appCategory('doomed', { color: 'cyan' }))
    await put(A, 'budgets', `${category}_CRC`, budgetData(Number(category), 'CRC', 5000))
    await put(A, 'transactions', txId, appTx('moved', { categoryId: Number(category) }))
    tracker.countWrites(cfg.runId, 4)
    const batch = writeBatch(A.db)
    batch.update(refOf(A, 'transactions', txId), { categoryId: 1 })
    batch.delete(refOf(A, 'budgets', `${category}_CRC`))
    batch.delete(refOf(A, 'budgets', `${category}_USD`)) // does not exist: allowed
    batch.delete(refOf(A, 'categories', category))
    await batch.commit()
    expect((await getDocFromServer(refOf(A, 'transactions', txId))).data().categoryId).toBe(1)
    expect((await getDocFromServer(refOf(A, 'categories', category))).exists()).toBe(false)
    expect((await getDocFromServer(refOf(A, 'budgets', `${category}_CRC`))).exists()).toBe(false)
  })

  // The limits the app accepts must pass: if one of these is refused, the
  // rules are tighter than the app and a person would get "permission-denied".
  test('the largest amount, the oldest date and a 120 character note', async () => {
    const id = await newId()
    const data = appTx('max', {
      amount: 1_000_000_000,
      date: '2000-01-01',
      note: `${cfg.tag} `.padEnd(120, 'x'),
    })
    expect(data.amountCents).toBe(100_000_000_000)
    await put(A, 'transactions', id, data)
    expect((await getDocFromServer(refOf(A, 'transactions', id))).data()).toEqual(data)
  })

  test('60 emoji in a note and 24 in a category name (size() counts them as the app does)', async () => {
    const id = await newId()
    const data = appTx('emoji', { note: '\u{1F600}'.repeat(60), date: '2100-12-31' })
    await put(A, 'transactions', id, data)
    const category = await newId()
    await put(A, 'categories', category, categoryData({ name: '\u{1F600}'.repeat(24), color: 'sand' }))
    expect((await getDocFromServer(refOf(A, 'categories', category))).exists()).toBe(true)
  })
})
