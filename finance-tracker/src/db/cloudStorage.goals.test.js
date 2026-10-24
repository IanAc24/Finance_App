import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The same small in-memory Firestore as cloudStorage.test.js (see there): a
// write lands in it at once; `fake.mode` says how the server answers
const fake = vi.hoisted(() => ({ docs: new Map(), mode: 'ok', batches: 0, late: null }))

vi.mock('../lib/firebase', () => ({ getCloudDb: () => ({}) }))

vi.mock('firebase/firestore', () => {
  const snapshotOf = (path) => {
    const data = fake.docs.get(path)
    return {
      id: path.split('/').pop(),
      ref: { path },
      exists: () => data !== undefined,
      data: () => (data === undefined ? undefined : structuredClone(data)),
    }
  }
  const list = (target) => {
    const prefix = `${target.path}/`
    return {
      docs: [...fake.docs.keys()]
        .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
        .map(snapshotOf),
    }
  }
  const apply = (ops) => {
    for (const [kind, ref, data] of ops) {
      if (kind === 'set') fake.docs.set(ref.path, structuredClone(data))
      if (kind === 'update') {
        fake.docs.set(ref.path, { ...(fake.docs.get(ref.path) ?? {}), ...structuredClone(data) })
      }
      if (kind === 'delete') fake.docs.delete(ref.path)
    }
  }
  return {
    collection: (db, ...parts) => ({ path: parts.join('/') }),
    doc: (db, ...parts) => ({ path: parts.join('/'), id: parts[parts.length - 1] }),
    query: (target) => target,
    where: () => ({}),
    getDocs: async (target) => list(target),
    getDocsFromCache: async (target) => list(target),
    getDoc: async (ref) => snapshotOf(ref.path),
    getDocFromCache: async (ref) => snapshotOf(ref.path),
    writeBatch: () => {
      const ops = []
      return {
        set: (ref, data) => ops.push(['set', ref, data]),
        update: (ref, data) => ops.push(['update', ref, data]),
        delete: (ref) => ops.push(['delete', ref]),
        commit: () => {
          fake.batches += 1
          apply(ops)
          if (fake.mode === 'reject') {
            return Promise.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }))
          }
          if (fake.mode === 'offline') {
            return new Promise((resolve, reject) => {
              fake.late = { resolve, reject }
            })
          }
          // 'slow': answers after 3 s (more than a normal save waits, less than a confirmed one)
          if (fake.mode === 'slow') {
            return new Promise((resolve) => setTimeout(resolve, 3000))
          }
          return Promise.resolve()
        },
      }
    },
  }
})

const cloud = await import('./cloudStorage')

const income = {
  amount: 250000,
  currency: 'CRC',
  type: 'income',
  categoryId: null,
  note: 'Pay',
  date: '2026-10-01',
  paymentMethod: 'sinpe',
  source: 'salary',
}
const move = (changes = {}) => ({
  amount: 6000,
  currency: 'CRC',
  direction: 'in',
  note: '',
  date: '2026-10-02',
  ...changes,
})
const goal = (changes = {}) => ({
  name: 'Trip',
  target: 10000,
  currency: 'CRC',
  createdAt: '2026-09-01',
  achievedAt: null,
  ...changes,
})

beforeEach(() => {
  fake.docs.clear()
  fake.mode = 'ok'
  fake.batches = 0
  fake.late = null
  cloud.setCloudUser('ana')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('income source', () => {
  it('saves the source of an income and reads it back', async () => {
    const saved = await cloud.insertTransaction(income)
    expect(fake.docs.get(`users/ana/transactions/${saved.id}`).source).toBe('salary')
    expect(saved.source).toBe('salary')
    expect((await cloud.loadAll()).transactions[0].source).toBe('salary')
  })

  it('leaves the field out for an expense, no source or an unknown one (absent = none)', async () => {
    const a = await cloud.insertTransaction({ ...income, type: 'expense', categoryId: 1 })
    const b = await cloud.insertTransaction({ ...income, source: undefined })
    const c = await cloud.insertTransaction({ ...income, source: 'lottery' })
    for (const saved of [a, b, c]) {
      expect('source' in fake.docs.get(`users/ana/transactions/${saved.id}`)).toBe(false)
    }
    const state = await cloud.loadAll()
    expect(state.transactions.map((tx) => tx.source)).toEqual([null, null, null])
  })

  it('reads a document written before sources existed as none', async () => {
    fake.docs.set('users/ana/transactions/5', {
      amountCents: 100,
      currency: 'CRC',
      type: 'income',
      categoryId: null,
      note: '',
      date: '2026-10-01',
      paymentMethod: 'cash',
    })
    expect((await cloud.loadAll()).transactions[0].source).toBeNull()
  })

  it('changes and clears the source on update', async () => {
    const { id } = await cloud.insertTransaction(income)
    await cloud.updateTransaction(id, { ...income, source: 'gift' })
    expect(fake.docs.get(`users/ana/transactions/${id}`).source).toBe('gift')
    await cloud.updateTransaction(id, { ...income, source: null })
    expect('source' in fake.docs.get(`users/ana/transactions/${id}`)).toBe(false)
  })
})

describe('savings goals', () => {
  it('saves the document with its documented fields and reads it back', async () => {
    const { goal: saved, status } = await cloud.insertGoal(goal({ target: 99.99 }))
    expect(status).toBe('confirmed')
    expect(fake.docs.get(`users/ana/goals/${saved.id}`)).toEqual({
      name: 'Trip',
      targetCents: 9999,
      currency: 'CRC',
      createdAt: '2026-09-01',
      achievedAt: null,
    })
    expect((await cloud.loadAll()).goals).toEqual([saved])
    expect(saved.target).toBe(99.99)
  })

  it('updates the whole goal and deletes it', async () => {
    const { goal: saved } = await cloud.insertGoal(goal())
    const updated = await cloud.updateGoal(saved.id, goal({ name: 'Car', target: 20, currency: 'USD' }))
    expect(updated.goal).toEqual({ ...goal({ name: 'Car', target: 20, currency: 'USD' }), id: saved.id })
    expect((await cloud.loadAll()).goals).toEqual([updated.goal])
    await cloud.deleteGoal(saved.id)
    expect((await cloud.loadAll()).goals).toEqual([])
  })

  it('refuses invalid goals before writing', async () => {
    for (const bad of [goal({ name: ' ' }), goal({ target: 0 }), goal({ target: 1e12 }), goal({ currency: 'EUR' })]) {
      await expect(cloud.insertGoal(bad)).rejects.toThrow()
    }
    await expect(cloud.insertGoal(goal({ id: 0.5 }))).rejects.toThrow('Invalid goal id')
    expect(fake.batches).toBe(0)
  })

  it('leaves out goal documents that are not valid', async () => {
    fake.docs.set('users/ana/goals/1', { name: 'Ok', targetCents: 500, currency: 'CRC', createdAt: '2026-01-01', achievedAt: null })
    fake.docs.set('users/ana/goals/2', { name: 'No target', targetCents: -1, currency: 'CRC', createdAt: '2026-01-01' })
    fake.docs.set('users/ana/goals/3', { name: '', targetCents: 500, currency: 'CRC', createdAt: '2026-01-01' })
    fake.docs.set('users/ana/goals/4', { name: 'Bad currency', targetCents: 500, currency: 'EUR', createdAt: '2026-01-01' })
    fake.docs.set('users/ana/goals/5', { name: 'Bad date', targetCents: 500, currency: 'CRC', createdAt: 'x' })
    fake.docs.set('users/ana/goals/6', { name: 'Odd achieved', targetCents: 500, currency: 'USD', createdAt: '2026-01-01', achievedAt: 'x' })
    const goals = (await cloud.loadAll()).goals
    expect(goals.map((g) => g.id)).toEqual([1, 6])
    expect(goals[1].achievedAt).toBeNull()
  })

  it('keeps each account to itself', async () => {
    await cloud.insertGoal(goal())
    cloud.setCloudUser('beto')
    expect((await cloud.loadAll()).goals).toEqual([])
  })

  it('writing the same goal id twice leaves one document', async () => {
    const id = 1_800_000_000_000_555
    await cloud.insertGoal(goal({ id }))
    await cloud.insertGoal(goal({ id, name: 'Retry' }))
    const paths = [...fake.docs.keys()].filter((p) => p.startsWith('users/ana/goals/'))
    expect(paths).toEqual([`users/ana/goals/${id}`])
    expect(fake.docs.get(paths[0]).name).toBe('Retry')
  })

  it('goes away with clearAll and comes back with restoreAll and an upload', async () => {
    const { goal: saved } = await cloud.insertGoal(goal({ achievedAt: '2026-10-01' }))
    const state = await cloud.loadAll()
    await cloud.clearAll()
    expect((await cloud.loadAll()).goals).toEqual([])

    const base = { ...state, categories: [], goals: state.goals }
    expect((await cloud.restoreAll(base)).goals).toEqual([saved])
    // a restore replaces them; one without the list (an older backup) leaves none
    const { goals, ...old } = base
    expect(goals).toHaveLength(1)
    expect((await cloud.restoreAll(old)).goals).toEqual([])
    // the data of this device is uploaded with its goals, twice without duplicates
    await cloud.uploadLocalData(base)
    expect((await cloud.uploadLocalData(base)).goals).toEqual([saved])
  })
})

describe('savings moves with an id made by the caller', () => {
  it('uses the id as the document name', async () => {
    const id = 1_800_000_000_000_001
    const { move: saved } = await cloud.saveSavingsMove(move({ id }))
    expect(saved.id).toBe(id)
    expect(fake.docs.has(`users/ana/savings/${id}`)).toBe(true)
  })

  it('writing the same id twice leaves one document (a retry does not duplicate)', async () => {
    const id = 1_800_000_000_000_002
    await cloud.saveSavingsMove(move({ id }))
    await cloud.saveSavingsMove(move({ id }))
    await cloud.insertSavingsMove(move({ id }))
    expect((await cloud.loadAll()).savings.map((m) => m.id)).toEqual([id])
  })

  it('makes a new id when none is given, and refuses an invalid one', async () => {
    const a = await cloud.insertSavingsMove(move())
    const b = await cloud.insertSavingsMove(move())
    expect(a.id).not.toBe(b.id)
    for (const bad of [0, -1, 1.5, '7']) {
      await expect(cloud.saveSavingsMove(move({ id: bad }))).rejects.toThrow('Invalid savings move id')
    }
  })

  it('an income with savings keeps the id of its move', async () => {
    const result = await cloud.insertIncomeWithSavings(income, move({ id: 4242 }))
    expect(result.move.id).toBe(4242)
    expect(fake.docs.has('users/ana/savings/4242')).toBe(true)
  })

  it('savings moves are never transactions', async () => {
    await cloud.saveSavingsMove(move({ id: 1 }))
    await cloud.saveSavingsMove(move({ id: 2, direction: 'out', amount: 100 }))
    const paths = [...fake.docs.keys()]
    expect(paths.some((p) => p.includes('/transactions/'))).toBe(false)
  })
})

describe('goals reached by a deposit', () => {
  it('marks them in the SAME batch as the deposit', async () => {
    const { goal: saved } = await cloud.insertGoal(goal({ target: 5000 }))
    fake.batches = 0
    const result = await cloud.saveSavingsMove(move({ id: 10 }), {
      achieveGoalIds: [saved.id],
      achievedAt: '2026-10-24',
    })
    expect(fake.batches).toBe(1)
    expect(result.achievedGoalIds).toEqual([saved.id])
    const state = await cloud.loadAll()
    expect(state.goals[0].achievedAt).toBe('2026-10-24')
    expect(state.savings.map((m) => m.id)).toEqual([10])
  })

  it('a withdrawal marks nothing, whatever it is given', async () => {
    const { goal: saved } = await cloud.insertGoal(goal({ target: 1 }))
    const result = await cloud.saveSavingsMove(move({ id: 11, direction: 'out' }), {
      achieveGoalIds: [saved.id],
    })
    expect(result.achievedGoalIds).toEqual([])
    expect((await cloud.loadAll()).goals[0].achievedAt).toBeNull()
  })

  it('rejects when the batch is refused, so nothing is celebrated', async () => {
    fake.mode = 'reject'
    await expect(
      cloud.saveSavingsMove(move({ id: 10 }), { achieveGoalIds: [1], achievedAt: '2026-10-24' }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('an income with savings marks them in its one batch too', async () => {
    const { goal: saved } = await cloud.insertGoal(goal({ target: 5000 }))
    fake.batches = 0
    const result = await cloud.insertIncomeWithSavings(income, move({ id: 12 }), {
      achieveGoalIds: [saved.id],
      achievedAt: '2026-10-24',
    })
    expect(fake.batches).toBe(1)
    expect(result.achievedGoalIds).toEqual([saved.id])
    expect(result.status).toBe('confirmed')
    expect((await cloud.loadAll()).goals[0].achievedAt).toBe('2026-10-24')
  })
})

describe('confirmed saves ({ awaitServer: true })', () => {
  it('is confirmed when Google answers ok', async () => {
    const result = await cloud.saveSavingsMove(move({ id: 1 }), { awaitServer: true })
    expect(result.status).toBe('confirmed')
    expect((await cloud.insertGoal(goal(), { awaitServer: true })).status).toBe('confirmed')
  })

  it('is pending, not failed, when Google has not answered after the timeout', async () => {
    vi.useFakeTimers()
    fake.mode = 'offline'
    let settled = null
    const pending = cloud
      .saveSavingsMove(move({ id: 1 }), { awaitServer: true })
      .then((result) => (settled = result))
    // a normal save would have given up waiting by now; this one keeps waiting
    await vi.advanceTimersByTimeAsync(cloud.WRITE_WAIT_MS + 1)
    expect(settled).toBeNull()
    await vi.advanceTimersByTimeAsync(cloud.CONFIRM_WAIT_MS)
    await pending
    expect(settled).toMatchObject({ status: 'pending', achievedGoalIds: [] })
    // the write stays queued: it is in the browser copy and will sync
    expect(fake.docs.has('users/ana/savings/1')).toBe(true)
    expect(cloud.CONFIRM_WAIT_MS).toBe(8000)
  })

  it('a normal save of the same move says pending after 1 s and confirmed if the server is quick', async () => {
    vi.useFakeTimers()
    fake.mode = 'slow'
    const normal = cloud.saveSavingsMove(move({ id: 1 }))
    await vi.advanceTimersByTimeAsync(cloud.WRITE_WAIT_MS)
    expect((await normal).status).toBe('pending')
    const confirmed = cloud.saveSavingsMove(move({ id: 2 }), { awaitServer: true })
    await vi.advanceTimersByTimeAsync(3000)
    expect((await confirmed).status).toBe('confirmed')
  })

  it('rejects when Google refuses in time', async () => {
    fake.mode = 'reject'
    await expect(cloud.saveSavingsMove(move({ id: 1 }), { awaitServer: true })).rejects.toMatchObject({
      code: 'permission-denied',
    })
    await expect(cloud.insertGoal(goal(), { awaitServer: true })).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it('still reports a refusal that comes after the pending answer', async () => {
    vi.useFakeTimers()
    fake.mode = 'offline'
    const listener = vi.fn()
    const stop = cloud.onCloudWriteError(listener)
    const pending = cloud.saveSavingsMove(move({ id: 1 }), { awaitServer: true })
    await vi.advanceTimersByTimeAsync(cloud.CONFIRM_WAIT_MS)
    expect((await pending).status).toBe('pending')
    fake.late.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ code: 'permission-denied' }))
    stop()
  })

  it('works for a goal update too', async () => {
    const { goal: saved } = await cloud.insertGoal(goal())
    expect((await cloud.updateGoal(saved.id, goal({ name: 'New' }), { awaitServer: true })).status).toBe(
      'confirmed',
    )
  })
})
