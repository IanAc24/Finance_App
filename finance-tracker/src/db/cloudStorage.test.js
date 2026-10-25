import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A small Firestore in memory, no network. Writes land in it at once (like
// the browser copy of the real one); `fake.mode` says how the server answers:
// 'ok', 'reject' (at once) or 'offline' (never, like commit() without internet).
const fake = vi.hoisted(() => ({
  docs: new Map(),
  mode: 'ok',
  batches: 0,
  late: null,
}))

vi.mock('../lib/firebase', () => ({ getCloudDb: () => ({}) }))

vi.mock('firebase/firestore', () => {
  const snapshotOf = (path) => {
    const data = fake.docs.get(path)
    const id = path.split('/').pop()
    return {
      id,
      ref: { path, id },
      exists: () => data !== undefined,
      data: () => (data === undefined ? undefined : structuredClone(data)),
    }
  }
  const list = (target) => {
    const prefix = `${target.path}/`
    const docs = [...fake.docs.keys()]
      .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(snapshotOf)
      .filter((snap) =>
        (target.filters ?? []).every((f) => snap.data()[f.field] === f.value),
      )
    return { docs }
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
    query: (target, ...filters) => ({ ...target, filters }),
    where: (field, op, value) => ({ field, op, value }),
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
          return Promise.resolve()
        },
      }
    },
  }
})

const cloud = await import('./cloudStorage')

const expense = {
  amount: 1500.5,
  currency: 'CRC',
  type: 'expense',
  categoryId: 1,
  note: 'Pan',
  date: '2026-10-20',
  paymentMethod: 'cash',
}

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

describe('accounts', () => {
  it('needs a signed-in account', async () => {
    cloud.setCloudUser(null)
    await expect(cloud.loadAll()).rejects.toThrow('No signed-in account')
  })

  it('keeps each account to itself', async () => {
    await cloud.insertTransaction({ ...expense, amount: 200000 })
    cloud.setCloudUser('beto')
    await cloud.insertTransaction({ ...expense, amount: 300000 })

    const beto = await cloud.loadAll()
    expect(beto.transactions.map((tx) => tx.amount)).toEqual([300000])
    cloud.setCloudUser('ana')
    const ana = await cloud.loadAll()
    expect(ana.transactions.map((tx) => tx.amount)).toEqual([200000])
    expect([...fake.docs.keys()].every((p) => p.startsWith('users/ana/') || p.startsWith('users/beto/'))).toBe(true)
  })
})

describe('saving and reading', () => {
  it('saves whole cents under the account and reads them back', async () => {
    const saved = await cloud.insertTransaction(expense)
    expect(fake.docs.get(`users/ana/transactions/${saved.id}`)).toEqual({
      amountCents: 150050,
      currency: 'CRC',
      type: 'expense',
      categoryId: 1,
      note: 'Pan',
      date: '2026-10-20',
      paymentMethod: 'cash',
    })
    const state = await cloud.loadAll()
    expect(state.transactions).toEqual([saved])
    expect(state.transactions[0].amount).toBe(1500.5)
  })

  it('starts an empty account with the built-in categories, 15/30 and no profile', async () => {
    const state = await cloud.loadAll()
    expect(state.transactions).toEqual([])
    expect(state.categories.map((c) => c.key)).toEqual(['food', 'transport', 'bills', 'fun'])
    expect(state.quincenaSchedule).toEqual([{ from: '2000-01-01', mode: 'fixed', day1: 1, day2: 16 }])
    expect(state.profile.onboardedAt).toBe(null)
  })

  it('refuses amounts that are not valid', async () => {
    for (const amount of [0, -5, NaN, Infinity, 2_000_000_000]) {
      await expect(cloud.insertTransaction({ ...expense, amount })).rejects.toThrow('Invalid amount')
    }
    expect(fake.docs.size).toBe(0)
  })

  it('leaves out documents without a valid amount instead of breaking totals', async () => {
    fake.docs.set('users/ana/transactions/5', { amountCents: 'mucho', currency: 'CRC' })
    fake.docs.set('users/ana/transactions/6', { ...expense, amountCents: 100 })
    const state = await cloud.loadAll()
    expect(state.transactions.map((tx) => tx.id)).toEqual([6])
  })

  it('updates and deletes a transaction', async () => {
    const saved = await cloud.insertTransaction(expense)
    await cloud.updateTransaction(saved.id, { ...expense, amount: 99 })
    expect((await cloud.loadAll()).transactions[0].amount).toBe(99)
    await cloud.deleteTransaction(saved.id)
    expect((await cloud.loadAll()).transactions).toEqual([])
  })
})

describe('without internet and when Firebase says no', () => {
  it('does not hang without internet: the save goes on after a moment', async () => {
    vi.useFakeTimers()
    fake.mode = 'offline'
    const pending = cloud.insertTransaction(expense)
    await vi.advanceTimersByTimeAsync(cloud.WRITE_WAIT_MS)
    const saved = await pending
    expect(fake.docs.has(`users/ana/transactions/${saved.id}`)).toBe(true)
  })

  it('reports a write rejected right away as a failed save', async () => {
    fake.mode = 'reject'
    await expect(cloud.insertTransaction(expense)).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('tells the app when a write is rejected later (back online)', async () => {
    vi.useFakeTimers()
    fake.mode = 'offline'
    const listener = vi.fn()
    const stop = cloud.onCloudWriteError(listener)
    const pending = cloud.insertTransaction(expense)
    await vi.advanceTimersByTimeAsync(cloud.WRITE_WAIT_MS)
    await pending
    fake.late.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ code: 'permission-denied' }))
    stop()
  })
})

describe('categories, budgets and recurring', () => {
  it('moves transactions and recurring items when a category is deleted', async () => {
    const category = await cloud.insertCategory({ name: 'Mascota', color: 'cyan' })
    const tx = await cloud.insertTransaction({ ...expense, categoryId: category.id })
    const item = await cloud.insertRecurring({ ...expense, categoryId: category.id, schedule: 'monthly' })
    await cloud.deleteCategory(category.id, 2)
    const state = await cloud.loadAll()
    expect(state.categories.some((c) => c.id === category.id)).toBe(false)
    expect(state.transactions.find((t) => t.id === tx.id).categoryId).toBe(2)
    expect(state.recurring.find((r) => r.id === item.id).categoryId).toBe(2)
  })

  it('deletes the budgets of a deleted category', async () => {
    const category = await cloud.insertCategory({ name: 'Mascota', color: 'cyan' })
    await cloud.setBudget(category.id, 'CRC', 50000)
    await cloud.setBudget(category.id, 'USD', 80)
    await cloud.setBudget(2, 'CRC', 10000)
    await cloud.deleteCategory(category.id, 2)
    expect((await cloud.loadAll()).budgets).toEqual([{ categoryId: 2, currency: 'CRC', amount: 10000 }])
  })

  it('never changes or deletes a built-in category', async () => {
    await cloud.updateCategory(1, { name: 'X', color: 'cyan' })
    await cloud.deleteCategory(1, 2)
    expect(fake.docs.size).toBe(0)
  })

  it('sets and removes a budget', async () => {
    expect(await cloud.setBudget(1, 'CRC', 50000)).toEqual({ categoryId: 1, currency: 'CRC', amount: 50000 })
    expect((await cloud.loadAll()).budgets).toEqual([{ categoryId: 1, currency: 'CRC', amount: 50000 }])
    expect(await cloud.setBudget(1, 'CRC', 0)).toBe(null)
    expect((await cloud.loadAll()).budgets).toEqual([])
  })

  it('refuses a negative or non-finite budget and keeps the saved one', async () => {
    await cloud.setBudget(1, 'CRC', 50000)
    for (const bad of [-5, NaN, Infinity]) {
      await expect(cloud.setBudget(1, 'CRC', bad)).rejects.toMatchObject({ code: 'invalidInput' })
    }
    expect((await cloud.loadAll()).budgets).toEqual([{ categoryId: 1, currency: 'CRC', amount: 50000 }])
    expect(await cloud.setBudget(1, 'CRC', null)).toBe(null)
    expect((await cloud.loadAll()).budgets).toEqual([])
  })

  it('confirms a recurring item: adds the transaction and marks the period', async () => {
    const item = await cloud.insertRecurring({ ...expense, schedule: 'monthly' })
    const tx = await cloud.confirmRecurring(item.id, '2026-10', expense)
    const state = await cloud.loadAll()
    expect(state.transactions.map((t) => t.id)).toEqual([tx.id])
    expect(state.recurring[0].lastPeriod).toBe('2026-10')
    await cloud.skipRecurring(item.id, '2026-11')
    expect((await cloud.loadAll()).recurring[0].lastPeriod).toBe('2026-11')
  })

  it('adds an income and its savings part together', async () => {
    const saved = await cloud.insertIncomeWithSavings(
      { ...expense, type: 'income', amount: 500000 },
      { amount: 50000, currency: 'CRC', direction: 'in', note: '', date: '2026-10-20' },
    )
    const state = await cloud.loadAll()
    expect(state.transactions.map((t) => t.id)).toEqual([saved.transaction.id])
    expect(state.savings.map((m) => m.amount)).toEqual([50000])
  })
})

describe('whole-account operations', () => {
  it('restores a backup, keeping its ids and replacing what was there', async () => {
    await cloud.insertTransaction(expense)
    const state = await cloud.restoreAll({
      transactions: [{ ...expense, id: 7 }],
      categories: [{ id: 30, name: 'Mascota', color: 'cyan' }],
      budgets: [{ categoryId: 1, currency: 'CRC', amount: 1000 }],
      recurring: [{ ...expense, id: 8, schedule: 'monthly', lastPeriod: '2026-09' }],
      savings: [{ id: 9, amount: 10, currency: 'USD', direction: 'in', note: '', date: '2026-10-01' }],
      quincenaSchedule: [{ from: '2000-01-01', mode: 'paydays', day1: 15, day2: 30 }],
      profile: { name: 'Ana', income: 400000, currency: 'CRC', savingsGoal: null },
    })
    expect(state.transactions.map((t) => t.id)).toEqual([7])
    expect(state.categories.map((c) => c.id)).toEqual([1, 2, 3, 4, 30])
    expect(state.recurring[0].lastPeriod).toBe('2026-09')
    expect(state.savings[0].id).toBe(9)
    expect(state.quincenaSchedule[0].day1).toBe(15)
    expect(state.profile.name).toBe('Ana')
    expect(state.profile.onboardedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('clears the account back to a new one', async () => {
    await cloud.insertTransaction(expense)
    await cloud.saveProfileName('Ana')
    await cloud.clearAll()
    const state = await cloud.loadAll()
    expect(state.transactions).toEqual([])
    expect(state.profile).toEqual({ name: '', income: null, currency: 'CRC', savingsGoal: null, onboardedAt: null })
  })

  it('finishes the welcome: new category, recurring item, profile and schedule', async () => {
    const state = await cloud.completeOnboarding({
      profile: { name: 'Ana', income: 400000, currency: 'CRC', savingsGoal: 50000 },
      schedule: [{ from: '2000-01-01', mode: 'paydays', day1: 15, day2: 30 }],
      add: [{ ...expense, newCategory: 'Gimnasio', categoryId: null, schedule: 'monthly' }],
    })
    const gym = state.categories.find((c) => c.name === 'Gimnasio')
    expect(gym).toBeTruthy()
    expect(state.recurring.map((r) => r.categoryId)).toEqual([gym.id])
    expect(state.profile).toMatchObject({ name: 'Ana', income: 400000, savingsGoal: 50000 })
    expect(state.profile.onboardedAt).not.toBe(null)
    expect(state.quincenaSchedule[0].day1).toBe(15)
  })

  it('fails the welcome if the item to change was deleted meanwhile', async () => {
    await expect(
      cloud.completeOnboarding({
        profile: { name: '', currency: 'CRC' },
        update: { id: 123, item: { ...expense, schedule: 'monthly' } },
      }),
    ).rejects.toThrow('Recurring item not found')
  })

  it('skips the welcome and saves the name', async () => {
    expect((await cloud.skipOnboarding()).onboardedAt).not.toBe(null)
    expect((await cloud.saveProfileName('  Beto  ')).name).toBe('Beto')
  })

  it('uploads the data of this device with its own ids, so doing it twice does not duplicate', async () => {
    const device = {
      transactions: [{ ...expense, id: 1 }, { ...expense, id: 2, amount: 10 }],
      categories: [{ id: 1, key: 'food', color: 'orange' }, { id: 5, name: 'Casa', color: 'cyan' }],
      budgets: [],
      recurring: [],
      savings: [],
      quincenaSchedule: [{ from: '2000-01-01', mode: 'fixed', day1: 1, day2: 16 }],
      profile: { name: 'Ana', income: null, currency: 'CRC', savingsGoal: null, onboardedAt: '2026-01-05' },
    }
    await cloud.uploadLocalData(device)
    const state = await cloud.uploadLocalData(device)
    expect(state.transactions.map((t) => t.id)).toEqual([1, 2])
    expect(state.categories.filter((c) => c.name).map((c) => c.id)).toEqual([5])
    expect(state.profile.onboardedAt).toBe('2026-01-05')
  })

  it('splits big jobs into batches of at most 450 writes', async () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ ...expense, amount: i + 1 }))
    await cloud.insertTransactions(many)
    expect(fake.batches).toBe(3)
    expect((await cloud.loadAll()).transactions).toHaveLength(1000)
  })
})
