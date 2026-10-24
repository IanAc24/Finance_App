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
import { QaGuardError, describeConfig, readQaConfig } from './lib/env.js'
import * as tracker from './lib/tracker.js'
import { makeClient, taggedDocs, teardown } from './lib/sdk.js'

// Rules tests against the REAL Firestore of the test project, with real
// signed-in test accounts (see docs/qa/firebase-real.md). Every document is
// written under the signed-in user's own users/{uid}/ path, has a numeric id
// built from the run id, carries the tag "QA-<runId>" and is removed at the
// end by teardown. Each write is counted against QA_MAX_WRITES.
//
// Port of the emulator list E1-E20 of docs/qa/revision-seguridad-firebase.md
// to the real project (only what is safe to do there). Tests marked
// "KNOWN GAP" use test.fails: they PASS while the rules do not validate yet,
// and turn red the day the hardened rules are published (then remove the
// ".fails" and the marker).

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

function tx(label, extra = {}) {
  return {
    amountCents: 12345,
    currency: 'CRC',
    type: 'expense',
    categoryId: null,
    note: note(label),
    date: today,
    paymentMethod: 'cash',
    ...extra,
  }
}

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

const newId = () => tracker.newDocId(cfg.runId)

// --- 1. the owner has full access to its own space -------------------------

describe('owner: create, read, update, delete in every collection', () => {
  const cases = [
    ['transactions', () => tx('own tx'), { amountCents: 99900 }],
    [
      'savings',
      () => ({ amountCents: 5000, currency: 'USD', direction: 'in', note: note('own saving'), date: today }),
      { amountCents: 7000 },
    ],
    [
      'budgets',
      () => ({ categoryId: 1, currency: 'CRC', amountCents: 2000000, qaTag: note('own budget') }),
      { amountCents: 3000000 },
    ],
    [
      'recurring',
      () => ({
        amountCents: 4000,
        currency: 'USD',
        type: 'expense',
        categoryId: null,
        note: note('own recurring'),
        schedule: 'every',
        lastPeriod: null,
      }),
      { amountCents: 4500 },
    ],
    ['categories', () => ({ name: note('cat').slice(0, 24), color: 'blue' }), { color: 'lime' }],
    // not meta/profile or meta/schedule: those are the account's real settings
    [
      'meta',
      () => ({ name: note('own meta'), incomeCents: 100000, currency: 'CRC', savingsGoalCents: null, onboardedAt: null }),
      { incomeCents: 200000 },
    ],
  ]

  test.each(cases)('%s', async (name, build, changes) => {
    const id = name === 'meta' ? `qa-${cfg.runId}` : name === 'budgets' ? `qa${cfg.runId}_CRC` : await newId()
    const data = build()
    await put(A, name, id, data) // create
    let snap = await getDocFromServer(refOf(A, name, id)) // read
    expect(snap.exists()).toBe(true)
    expect(snap.data()).toEqual(data)

    tracker.countWrites(cfg.runId, 1)
    const patch = changes
    await updateDoc(refOf(A, name, id), patch) // update
    snap = await getDocFromServer(refOf(A, name, id))
    expect(snap.data()).toEqual({ ...data, ...patch })

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
    for (const name of ['transactions', 'savings', 'budgets', 'recurring', 'categories', 'meta']) {
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

// --- 5. validation probes (KNOWN GAP while the rules validate nothing) -----------

describe('validation probes - KNOWN GAP until the hardened rules are published', () => {
  // Expected outcome today: the write is ACCEPTED (the gap is open), so the
  // assertion "must be rejected" fails and test.fails marks the test green.
  // See "firestore.rules propuesto" in docs/qa/revision-seguridad-firebase.md.
  const probes = [
    ['negative amountCents', () => ({ amountCents: -500 })],
    ['amountCents as a string', () => ({ amountCents: '500' })],
    ['unknown currency (EUR)', () => ({ currency: 'EUR' })],
    ['10,000 character note', () => ({ note: `${cfg.tag} ${'x'.repeat(10_000)}` })],
    ['extra fields', () => ({ admin: true, junk: 'x'.repeat(50) })],
  ]

  test.fails.each(probes)('KNOWN GAP: %s is rejected', async (name, build) => {
    const id = await newId()
    const data = tx('probe', build())
    let outcome = 'accepted (gap open)'
    try {
      await put(A, 'transactions', id, data)
    } catch (error) {
      outcome = error.code === 'permission-denied' ? 'rejected (enforced)' : `error: ${error.code}`
    }
    tracker.recordGap(cfg.runId, `validation: ${name}`, outcome)
    expect(outcome, `rules do not reject "${name}" yet; see docs/qa/revision-seguridad-firebase.md`).toBe(
      'rejected (enforced)',
    )
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
