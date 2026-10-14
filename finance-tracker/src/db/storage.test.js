import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runMigrations } from './migrations'
import { createTestDb } from './testDb'
import { DEFAULT_SCHEDULE } from '../lib/quincenaSchedule'
import { EMPTY_PROFILE } from '../lib/onboarding'

// storage.js gets its connection from ./database, which needs the browser.
// The mock hands out whatever database the current test put in `current`.
const current = vi.hoisted(() => ({ db: null, persist: null }))

vi.mock('./database', () => ({
  getDb: () => Promise.resolve(current.db),
  persist: (...args) => current.persist(...args),
}))

const builtIn = [
  { id: 1, key: 'food', color: 'orange' },
  { id: 2, key: 'transport', color: 'blue' },
  { id: 3, key: 'bills', color: 'violet' },
  { id: 4, key: 'fun', color: 'lime' },
]

let storage

// storage.js keeps module-level state (the write queue and the legacy-import
// promise). Resetting the module registry and importing it again gives every
// test a fresh copy, together with a fresh in-memory database.
beforeEach(async () => {
  current.db = await createTestDb()
  await runMigrations(current.db)
  current.persist = vi.fn().mockResolvedValue(undefined)
  vi.resetModules()
  storage = await import('./storage')
})

const tx = (changes = {}) => ({
  amount: 100,
  currency: 'CRC',
  type: 'expense',
  categoryId: 1,
  note: 'n',
  date: '2026-10-01',
  paymentMethod: 'cash',
  ...changes,
})

const recurringItem = (changes = {}) => ({
  amount: 45000,
  currency: 'CRC',
  type: 'expense',
  categoryId: 3,
  note: 'Rent',
  schedule: 'first',
  ...changes,
})

const move = (changes = {}) => ({
  amount: 5000,
  currency: 'CRC',
  direction: 'in',
  note: 'Trip',
  date: '2026-10-02',
  ...changes,
})

const rows = async (sql) => (await current.db.query(sql)).values
const noPending = () => expect(current.db.isTransactionActive()).resolves.toEqual({ result: false })

describe('loadAll', () => {
  it('reads a new database as the four built-in categories and nothing else', async () => {
    expect(typeof localStorage).toBe('undefined')

    const state = await storage.loadAll()

    expect(state.transactions).toEqual([])
    expect(state.categories).toEqual(builtIn)
    for (const category of state.categories) {
      expect(category).not.toHaveProperty('name')
    }
    expect(state.budgets).toEqual([])
    expect(state.recurring).toEqual([])
    expect(state.savings).toEqual([])
  })
})

describe('payment method', () => {
  it('is saved on insert and read back', async () => {
    const saved = await storage.insertTransaction(tx({ paymentMethod: 'sinpe' }))

    expect(saved.paymentMethod).toBe('sinpe')
    expect(await rows('SELECT payment_method FROM transactions')).toEqual([
      { payment_method: 'sinpe' },
    ])
    const { transactions } = await storage.loadAll()
    expect(transactions[0].paymentMethod).toBe('sinpe')
  })

  it('is cash when the caller does not say it', async () => {
    const { paymentMethod, ...without } = tx()
    expect(paymentMethod).toBe('cash')
    const saved = await storage.insertTransaction(without)

    expect(saved.paymentMethod).toBe('cash')
    expect(await rows('SELECT payment_method FROM transactions')).toEqual([
      { payment_method: 'cash' },
    ])
  })

  it('never writes a value outside the three methods', async () => {
    const saved = await storage.insertTransaction(tx({ paymentMethod: 'bitcoin' }))
    expect(saved.paymentMethod).toBe('cash')
    expect(await rows('SELECT payment_method FROM transactions')).toEqual([
      { payment_method: 'cash' },
    ])
  })

  it('changes on update', async () => {
    const { id } = await storage.insertTransaction(tx())
    const saved = await storage.updateTransaction(id, tx({ paymentMethod: 'card' }))

    expect(saved.paymentMethod).toBe('card')
    const { transactions } = await storage.loadAll()
    expect(transactions[0].paymentMethod).toBe('card')
  })

  it('is kept by insertTransactions and by an income saved with its move', async () => {
    const list = await storage.insertTransactions([
      tx({ paymentMethod: 'card' }),
      tx({ note: 'b' }),
    ])
    expect(list.map((item) => item.paymentMethod)).toEqual(['card', 'cash'])

    const income = tx({ type: 'income', categoryId: null, paymentMethod: 'sinpe' })
    const saved = await storage.insertIncomeWithSavings(income, move())
    expect(saved.transaction.paymentMethod).toBe('sinpe')
  })

  it('survives a restore', async () => {
    const result = await storage.restoreAll({
      categories: [],
      transactions: [{ ...tx({ paymentMethod: 'card' }), id: 4 }],
      budgets: [],
      recurring: [],
      savings: [],
    })
    expect(result.transactions[0].paymentMethod).toBe('card')
    expect(await rows('SELECT payment_method FROM transactions')).toEqual([
      { payment_method: 'card' },
    ])
  })

  it('reads a restored transaction without a method as cash', async () => {
    const { paymentMethod, ...old } = tx()
    expect(paymentMethod).toBe('cash')
    const result = await storage.restoreAll({
      categories: [],
      transactions: [{ ...old, id: 4 }],
      budgets: [],
      recurring: [],
      savings: [],
    })
    expect(result.transactions[0].paymentMethod).toBe('cash')
  })
})

describe('transactions', () => {
  it('inserts with a new id and stores whole cents', async () => {
    const saved = await storage.insertTransaction(tx({ amount: 9.99 }))

    expect(saved).toEqual({ ...tx({ amount: 9.99 }), id: 1 })
    expect(await rows('SELECT id, amount_cents FROM transactions')).toEqual([
      { id: 1, amount_cents: 999 },
    ])
    const { transactions } = await storage.loadAll()
    expect(transactions).toEqual([{ ...tx({ amount: 9.99 }), id: 1 }])
  })

  it('rounds awkward floats to the right cents', async () => {
    await storage.insertTransaction(tx({ amount: 8.35 }))
    await storage.insertTransaction(tx({ amount: 0.29 }))
    expect(
      await rows('SELECT amount_cents FROM transactions ORDER BY id'),
    ).toEqual([{ amount_cents: 835 }, { amount_cents: 29 }])
  })

  it('saves income with a null category and defaults a missing note to empty', async () => {
    const item = { ...tx({ type: 'income', categoryId: null }) }
    delete item.note

    const saved = await storage.insertTransaction(item)

    expect(saved.note).toBe('')
    const { transactions } = await storage.loadAll()
    expect(transactions[0]).toMatchObject({
      type: 'income',
      categoryId: null,
      note: '',
    })
  })

  it('inserts a list with consecutive ids in order', async () => {
    await storage.insertTransaction(tx({ note: 'first' }))
    const saved = await storage.insertTransactions([
      tx({ note: 'a', amount: 1 }),
      tx({ note: 'b', amount: 2 }),
      tx({ note: 'c', amount: 3 }),
    ])

    expect(saved.map((item) => [item.id, item.note])).toEqual([
      [2, 'a'],
      [3, 'b'],
      [4, 'c'],
    ])
    const { transactions } = await storage.loadAll()
    expect(transactions.map((item) => item.note)).toEqual([
      'first',
      'a',
      'b',
      'c',
    ])
  })

  it('inserts a list all or nothing', async () => {
    await storage.insertTransaction(tx({ note: 'kept' }))
    current.persist.mockClear()

    await expect(
      storage.insertTransactions([
        tx({ note: 'a' }),
        tx({ note: 'b' }),
        tx({ note: 'bad', amount: 0 }),
      ]),
    ).rejects.toThrow()

    const { transactions } = await storage.loadAll()
    expect(transactions.map((item) => item.note)).toEqual(['kept'])
    await noPending()
    expect(current.persist).not.toHaveBeenCalled()
  })

  it('updates a transaction', async () => {
    const { id } = await storage.insertTransaction(tx())
    await storage.insertTransaction(tx({ note: 'other' }))

    const saved = await storage.updateTransaction(
      id,
      tx({ amount: 12.5, currency: 'USD', categoryId: 2, note: 'changed' }),
    )

    expect(saved).toEqual({
      ...tx({ amount: 12.5, currency: 'USD', categoryId: 2, note: 'changed' }),
      id,
    })
    const { transactions } = await storage.loadAll()
    expect(transactions).toEqual([
      {
        id,
        amount: 12.5,
        currency: 'USD',
        type: 'expense',
        categoryId: 2,
        note: 'changed',
        date: '2026-10-01',
        paymentMethod: 'cash',
      },
      { ...tx({ note: 'other' }), id: 2 },
    ])
  })

  it('deletes a transaction', async () => {
    const first = await storage.insertTransaction(tx({ note: 'a' }))
    await storage.insertTransaction(tx({ note: 'b' }))

    await storage.deleteTransaction(first.id)

    const { transactions } = await storage.loadAll()
    expect(transactions.map((item) => item.note)).toEqual(['b'])
  })

  it('rejects an amount of 0 and leaves the table unchanged', async () => {
    const { id } = await storage.insertTransaction(tx({ amount: 5 }))
    const before = await rows('SELECT * FROM transactions')

    await expect(storage.insertTransaction(tx({ amount: 0 }))).rejects.toThrow()
    await expect(
      storage.updateTransaction(id, tx({ amount: 0 })),
    ).rejects.toThrow()

    expect(await rows('SELECT * FROM transactions')).toEqual(before)
  })
})

describe('categories', () => {
  it('inserts a custom category', async () => {
    const saved = await storage.insertCategory({ name: 'Pets', color: 'cyan' })

    expect(saved).toEqual({ id: 5, name: 'Pets', color: 'cyan' })
    const { categories } = await storage.loadAll()
    expect(categories).toEqual([...builtIn, saved])
  })

  it('updates a custom category but never a built-in one', async () => {
    const { id } = await storage.insertCategory({ name: 'Pets', color: 'cyan' })

    await storage.updateCategory(id, { name: 'Animals', color: 'sand' })
    await storage.updateCategory(1, { name: 'Hacked', color: 'sand' })

    const { categories } = await storage.loadAll()
    expect(categories).toEqual([
      ...builtIn,
      { id, name: 'Animals', color: 'sand' },
    ])
  })

  it('deletes a category and moves its transactions, recurring items and nothing else', async () => {
    const { id } = await storage.insertCategory({ name: 'Pets', color: 'cyan' })
    await storage.insertTransaction(tx({ categoryId: id, note: 'moves' }))
    await storage.insertTransaction(tx({ categoryId: 1, note: 'stays' }))
    await storage.insertRecurring(recurringItem({ categoryId: id }))
    await storage.insertRecurring(recurringItem({ categoryId: 3 }))
    await storage.setBudget(id, 'CRC', 1000)
    await storage.setBudget(1, 'CRC', 2000)

    await storage.deleteCategory(id, 4)

    const state = await storage.loadAll()
    expect(state.categories).toEqual(builtIn)
    expect(state.transactions.map((t) => [t.note, t.categoryId])).toEqual([
      ['moves', 4],
      ['stays', 1],
    ])
    expect(state.recurring.map((r) => r.categoryId)).toEqual([4, 3])
    expect(state.budgets).toEqual([
      { categoryId: 1, currency: 'CRC', amount: 2000 },
    ])
  })

  it('cannot delete a built-in category', async () => {
    await storage.deleteCategory(1, 2)

    const { categories } = await storage.loadAll()
    expect(categories).toEqual(builtIn)
  })

  it('leaves the transactions of a built-in category where they are', async () => {
    await storage.insertTransaction(tx({ categoryId: 1, note: 'food' }))
    await storage.insertRecurring(recurringItem({ categoryId: 1 }))
    await storage.setBudget(1, 'CRC', 1000)

    await storage.deleteCategory(1, 2)

    const state = await storage.loadAll()
    expect(state.transactions[0].categoryId).toBe(1)
    expect(state.recurring[0].categoryId).toBe(1)
    expect(state.budgets).toHaveLength(1)
  })
})

describe('budgets', () => {
  it('inserts, then updates the same category and currency', async () => {
    const first = await storage.setBudget(1, 'CRC', 50000)
    const second = await storage.setBudget(1, 'CRC', 75000.5)

    expect(first).toEqual({ categoryId: 1, currency: 'CRC', amount: 50000 })
    expect(second).toEqual({ categoryId: 1, currency: 'CRC', amount: 75000.5 })
    expect(await rows('SELECT * FROM budgets')).toEqual([
      { category_id: 1, currency: 'CRC', amount_cents: 7500050 },
    ])
  })

  it('keeps one budget per currency', async () => {
    await storage.setBudget(1, 'CRC', 50000)
    await storage.setBudget(1, 'USD', 100)

    const { budgets } = await storage.loadAll()
    expect(budgets).toEqual([
      { categoryId: 1, currency: 'CRC', amount: 50000 },
      { categoryId: 1, currency: 'USD', amount: 100 },
    ])
  })

  it('deletes the budget when the amount is 0, only for that currency', async () => {
    await storage.setBudget(1, 'CRC', 50000)
    await storage.setBudget(1, 'USD', 100)

    const result = await storage.setBudget(1, 'CRC', 0)

    expect(result).toBeNull()
    const { budgets } = await storage.loadAll()
    expect(budgets).toEqual([{ categoryId: 1, currency: 'USD', amount: 100 }])
  })
})

describe('recurring items', () => {
  it('inserts with no last period', async () => {
    const saved = await storage.insertRecurring(recurringItem())

    expect(saved).toEqual({ ...recurringItem(), id: 1, lastPeriod: null })
    const { recurring } = await storage.loadAll()
    expect(recurring).toEqual([saved])
  })

  it('updates everything but the last period', async () => {
    const { id } = await storage.insertRecurring(recurringItem())
    await storage.skipRecurring(id, '2026-10-1')

    const saved = await storage.updateRecurring(
      id,
      recurringItem({ amount: 50000.25, note: 'New rent', schedule: 'second' }),
    )

    expect(saved.id).toBe(id)
    const { recurring } = await storage.loadAll()
    expect(recurring).toEqual([
      {
        id,
        amount: 50000.25,
        currency: 'CRC',
        type: 'expense',
        categoryId: 3,
        note: 'New rent',
        schedule: 'second',
        lastPeriod: '2026-10-1',
      },
    ])
  })

  it('deletes an item', async () => {
    const first = await storage.insertRecurring(recurringItem({ note: 'a' }))
    await storage.insertRecurring(recurringItem({ note: 'b' }))

    await storage.deleteRecurring(first.id)

    const { recurring } = await storage.loadAll()
    expect(recurring.map((r) => r.note)).toEqual(['b'])
  })

  it('skips a period by setting it', async () => {
    const { id } = await storage.insertRecurring(recurringItem())
    await storage.insertRecurring(recurringItem({ note: 'other' }))

    await storage.skipRecurring(id, '2026-10-2')

    const { recurring } = await storage.loadAll()
    expect(recurring.map((r) => r.lastPeriod)).toEqual(['2026-10-2', null])
  })

  it('confirms by adding the transaction and setting the period together', async () => {
    const { id } = await storage.insertRecurring(recurringItem())

    const saved = await storage.confirmRecurring(
      id,
      '2026-10-1',
      tx({ amount: 45000, categoryId: 3, note: 'Rent' }),
    )

    expect(saved).toEqual({
      ...tx({ amount: 45000, categoryId: 3, note: 'Rent' }),
      id: 1,
    })
    const state = await storage.loadAll()
    expect(state.transactions).toEqual([saved])
    expect(state.recurring[0].lastPeriod).toBe('2026-10-1')
  })

  it('saves the transaction exactly as given, whatever the item says', async () => {
    const { id } = await storage.insertRecurring(recurringItem())
    const typed = tx({
      amount: 45000,
      categoryId: 2,
      note: 'Paid by hand',
      date: '2026-10-03',
    })

    const saved = await storage.confirmRecurring(id, '2026-10-1', typed)

    expect(saved).toEqual({ ...typed, id: 1 })
    const state = await storage.loadAll()
    expect(state.transactions).toEqual([saved])
    expect(state.recurring[0].lastPeriod).toBe('2026-10-1')
  })

  it('does not set the period when the transaction cannot be added', async () => {
    const { id } = await storage.insertRecurring(recurringItem())
    current.persist.mockClear()

    await expect(
      storage.confirmRecurring(id, '2026-10-1', tx({ amount: 0 })),
    ).rejects.toThrow()

    const state = await storage.loadAll()
    expect(state.transactions).toEqual([])
    expect(state.recurring[0].lastPeriod).toBeNull()
    await noPending()
    expect(current.persist).not.toHaveBeenCalled()
  })
})

describe('savings', () => {
  it('inserts with a new id, stores whole cents and defaults a missing note', async () => {
    const withNote = await storage.insertSavingsMove(move({ amount: 9.99 }))
    const item = move({ direction: 'out', currency: 'USD' })
    delete item.note
    const withoutNote = await storage.insertSavingsMove(item)

    expect(withNote).toEqual({ ...move({ amount: 9.99 }), id: 1 })
    expect(withoutNote).toEqual({
      ...move({ direction: 'out', currency: 'USD', note: '' }),
      id: 2,
    })
    expect(
      await rows('SELECT id, amount_cents, direction FROM savings ORDER BY id'),
    ).toEqual([
      { id: 1, amount_cents: 999, direction: 'in' },
      { id: 2, amount_cents: 500000, direction: 'out' },
    ])
    const { savings } = await storage.loadAll()
    expect(savings).toEqual([withNote, withoutNote])
  })

  it('deletes a move', async () => {
    const first = await storage.insertSavingsMove(move({ note: 'a' }))
    await storage.insertSavingsMove(move({ note: 'b' }))

    await storage.deleteSavingsMove(first.id)

    const { savings } = await storage.loadAll()
    expect(savings.map((item) => item.note)).toEqual(['b'])
  })

  it('rejects a bad direction, currency or amount and does not persist', async () => {
    current.persist.mockClear()

    await expect(
      storage.insertSavingsMove(move({ direction: 'up' })),
    ).rejects.toThrow()
    await expect(
      storage.insertSavingsMove(move({ currency: 'EUR' })),
    ).rejects.toThrow()
    await expect(storage.insertSavingsMove(move({ amount: 0 }))).rejects.toThrow()

    expect(await rows('SELECT * FROM savings')).toEqual([])
    expect(current.persist).not.toHaveBeenCalled()
  })

  it('saves an income and its move together', async () => {
    const income = tx({ type: 'income', categoryId: null, amount: 100000 })

    const saved = await storage.insertIncomeWithSavings(
      income,
      move({ amount: 20000, note: 'Pay' }),
    )

    expect(saved).toEqual({
      transaction: { ...income, id: 1 },
      move: { ...move({ amount: 20000, note: 'Pay' }), id: 1 },
    })
    const state = await storage.loadAll()
    expect(state.transactions).toEqual([saved.transaction])
    expect(state.savings).toEqual([saved.move])
    expect(current.persist).toHaveBeenCalledTimes(1)
  })

  it('saves neither when the move is invalid', async () => {
    await storage.insertTransaction(tx({ note: 'kept' }))
    current.persist.mockClear()

    await expect(
      storage.insertIncomeWithSavings(
        tx({ type: 'income', categoryId: null, note: 'lost' }),
        move({ amount: 0 }),
      ),
    ).rejects.toThrow()

    const state = await storage.loadAll()
    expect(state.transactions.map((item) => item.note)).toEqual(['kept'])
    expect(state.savings).toEqual([])
    await noPending()
    expect(current.persist).not.toHaveBeenCalled()
  })

  it('saves neither when the income is invalid', async () => {
    await expect(
      storage.insertIncomeWithSavings(
        tx({ type: 'income', categoryId: null, amount: 0 }),
        move(),
      ),
    ).rejects.toThrow()

    const state = await storage.loadAll()
    expect(state.transactions).toEqual([])
    expect(state.savings).toEqual([])
    await noPending()
  })
})

describe('quincena schedule', () => {
  const custom = [
    { from: '2000-01-01', mode: 'fixed', day1: 1, day2: 16 },
    { from: '2026-10-16', mode: 'paydays', day1: 5, day2: 20 },
  ]

  it('is 15/30 on a database that was just migrated', async () => {
    expect((await storage.loadAll()).quincenaSchedule).toEqual(DEFAULT_SCHEDULE)
  })

  it('is saved and read back, and persisted', async () => {
    const saved = await storage.saveQuincenaSchedule(custom)
    expect(saved).toEqual(custom)
    expect((await storage.loadAll()).quincenaSchedule).toEqual(custom)
    expect(current.persist).toHaveBeenCalledTimes(1)
    await noPending()
  })

  it('does not touch transactions, savings or recurring items', async () => {
    await storage.insertTransaction(tx({ date: '2026-10-03' }))
    await storage.insertRecurring(recurringItem({ schedule: 'second' }))
    await storage.insertSavingsMove(move())
    const before = await storage.loadAll()

    await storage.saveQuincenaSchedule(custom)

    const after = await storage.loadAll()
    expect(after.transactions).toEqual(before.transactions)
    expect(after.recurring).toEqual(before.recurring)
    expect(after.savings).toEqual(before.savings)
  })

  it('restores the previous schedule when the copy to disk fails', async () => {
    await storage.saveQuincenaSchedule(custom)
    current.persist.mockRejectedValueOnce(new Error('disk'))
    await expect(
      storage.saveQuincenaSchedule(DEFAULT_SCHEDULE),
    ).rejects.toThrow('disk')
    expect((await storage.loadAll()).quincenaSchedule).toEqual(custom)
    await noPending()
  })

  it('reads damaged rows as 15/30', async () => {
    await current.db.run('DELETE FROM quincena_config')
    expect((await storage.loadAll()).quincenaSchedule).toEqual(DEFAULT_SCHEDULE)
  })

  it('goes back to 15/30 when everything is cleared', async () => {
    await storage.saveQuincenaSchedule(custom)
    await storage.clearAll()
    expect((await storage.loadAll()).quincenaSchedule).toEqual(DEFAULT_SCHEDULE)
  })

  it('is replaced by the one in a backup, and is 15/30 when the backup has none', async () => {
    await storage.saveQuincenaSchedule(custom)
    const base = { categories: [], transactions: [], budgets: [], recurring: [] }

    const withIt = await storage.restoreAll({ ...base, quincenaSchedule: [custom[0], { from: '2026-12-01', mode: 'paydays', day1: 10, day2: null }] })
    expect(withIt.quincenaSchedule.map((e) => e.day1)).toEqual([1, 10])

    const without = await storage.restoreAll({ ...base, savings: [] })
    expect(without.quincenaSchedule).toEqual(DEFAULT_SCHEDULE)
    expect((await storage.loadAll()).quincenaSchedule).toEqual(DEFAULT_SCHEDULE)
  })
})

describe('clearAll', () => {
  it('removes everything the user added and keeps the built-in categories', async () => {
    const { id } = await storage.insertCategory({ name: 'Pets', color: 'cyan' })
    await storage.insertTransaction(tx({ categoryId: id }))
    await storage.setBudget(id, 'CRC', 100)
    await storage.setBudget(1, 'USD', 100)
    await storage.insertRecurring(recurringItem())
    await storage.insertSavingsMove(move())

    await storage.clearAll()

    expect(await storage.loadAll()).toEqual({
      profile: EMPTY_PROFILE,
      transactions: [],
      categories: builtIn,
      budgets: [],
      recurring: [],
      savings: [],
      quincenaSchedule: DEFAULT_SCHEDULE,
    })
  })

  it('also puts the pay days back to 15/30', async () => {
    await storage.saveQuincenaSchedule([
      { from: '2000-01-01', mode: 'fixed', day1: 1, day2: 16 },
      { from: '2026-10-16', mode: 'paydays', day1: 10, day2: 25 },
    ])
    expect((await storage.loadAll()).quincenaSchedule).toHaveLength(2)

    await storage.clearAll()

    expect(await storage.loadAll()).toEqual({
      profile: EMPTY_PROFILE,
      transactions: [],
      categories: builtIn,
      budgets: [],
      recurring: [],
      savings: [],
      quincenaSchedule: DEFAULT_SCHEDULE,
    })
  })
})

describe('restoreAll', () => {
  const data = () => ({
    categories: [{ id: 7, name: 'Pets', color: 'cyan' }],
    transactions: [
      { id: 20, ...tx({ amount: 9.99, categoryId: 7, note: 'Food for cat' }) },
      { id: 30, ...tx({ type: 'income', categoryId: null, amount: 250000 }) },
    ],
    budgets: [
      { categoryId: 7, currency: 'USD', amount: 20 },
      { categoryId: 1, currency: 'CRC', amount: 50000 },
    ],
    recurring: [
      { id: 4, ...recurringItem({ categoryId: 7 }), lastPeriod: '2026-10-1' },
      { id: 9, ...recurringItem({ categoryId: null, note: '' }), lastPeriod: null },
    ],
    savings: [
      { id: 6, ...move({ amount: 12.5, currency: 'USD', note: '' }) },
      { id: 2, ...move({ direction: 'out' }) },
    ],
  })

  const seed = async () => {
    const { id } = await storage.insertCategory({ name: 'Old', color: 'sand' })
    await storage.insertTransaction(tx({ categoryId: id, note: 'old' }))
    await storage.setBudget(id, 'CRC', 100)
    await storage.insertRecurring(recurringItem({ note: 'old' }))
    await storage.insertSavingsMove(move({ note: 'old' }))
    return storage.loadAll()
  }

  it('replaces everything, keeps ids and returns the new state', async () => {
    await seed()

    const result = await storage.restoreAll(data())

    const expected = data()
    expect(result).toEqual({
      // restoring means there is data: the welcome is done
      profile: { ...EMPTY_PROFILE, onboardedAt: expect.any(String) },
      categories: [...builtIn, expected.categories[0]],
      transactions: expected.transactions,
      budgets: [
        { categoryId: 1, currency: 'CRC', amount: 50000 },
        { categoryId: 7, currency: 'USD', amount: 20 },
      ],
      recurring: expected.recurring,
      // ordered by id
      savings: [expected.savings[1], expected.savings[0]],
      quincenaSchedule: DEFAULT_SCHEDULE,
    })
    expect(await storage.loadAll()).toEqual(result)
    expect(await rows('SELECT amount_cents FROM transactions WHERE id = 20')).toEqual([
      { amount_cents: 999 },
    ])
    // five seed writes and the restore
    expect(current.persist).toHaveBeenCalledTimes(6)
  })

  it.each([
    ['a transaction with amount 0', (d) => { d.transactions[1].amount = 0 }],
    ['a budget for a missing category', (d) => { d.budgets[0].categoryId = 99 }],
    ['a repeated transaction id', (d) => { d.transactions[1].id = 20 }],
    ['a savings move with a bad direction', (d) => { d.savings[1].direction = 'up' }],
    ['a savings move with amount 0', (d) => { d.savings[0].amount = 0 }],
  ])('is all or nothing with %s', async (_name, spoil) => {
    const before = await seed()
    const bad = data()
    spoil(bad)
    current.persist.mockClear()

    await expect(storage.restoreAll(bad)).rejects.toThrow()

    expect(await storage.loadAll()).toEqual(before)
    await noPending()
    expect(current.persist).not.toHaveBeenCalled()
  })
})

describe('restoreAll without savings in the data', () => {
  it('treats a missing savings list as empty and removes the old moves', async () => {
    await storage.insertSavingsMove(move({ note: 'old' }))

    const result = await storage.restoreAll({
      categories: [],
      transactions: [{ id: 1, ...tx() }],
      budgets: [],
      recurring: [],
    })

    expect(result.savings).toEqual([])
    expect(await rows('SELECT * FROM savings')).toEqual([])
    expect(result.transactions).toHaveLength(1)
  })
})

describe('persist', () => {
  it('is called once after each successful write', async () => {
    const { id } = await storage.insertTransaction(tx())
    expect(current.persist).toHaveBeenCalledTimes(1)

    await storage.insertTransactions([tx(), tx()])
    await storage.updateTransaction(id, tx({ note: 'x' }))
    await storage.deleteTransaction(id)
    await storage.setBudget(1, 'CRC', 5)
    await storage.setBudget(1, 'CRC', 0)
    const category = await storage.insertCategory({ name: 'P', color: 'cyan' })
    await storage.updateCategory(category.id, { name: 'Q', color: 'cyan' })
    await storage.deleteCategory(category.id, 1)
    const item = await storage.insertRecurring(recurringItem())
    await storage.updateRecurring(item.id, recurringItem())
    await storage.skipRecurring(item.id, '2026-10-1')
    await storage.confirmRecurring(item.id, '2026-10-2', tx())
    await storage.deleteRecurring(item.id)
    await storage.clearAll()

    expect(current.persist).toHaveBeenCalledTimes(15)
  })

  it('is not called by reads or by a write that fails', async () => {
    const { id } = await storage.insertTransaction(tx())
    current.persist.mockClear()

    await storage.loadAll()
    await expect(storage.insertTransaction(tx({ amount: 0 }))).rejects.toThrow()
    await expect(
      storage.updateTransaction(id, tx({ amount: 0 })),
    ).rejects.toThrow()
    await expect(storage.setBudget(99, 'CRC', 10)).rejects.toThrow()

    expect(current.persist).not.toHaveBeenCalled()
  })

  it('is called after the data is committed', async () => {
    let seen = null
    current.persist.mockImplementation(async () => {
      seen = {
        count: (await rows('SELECT COUNT(*) AS n FROM transactions'))[0].n,
        open: (await current.db.isTransactionActive()).result,
      }
    })

    await storage.insertTransactions([tx(), tx()])

    expect(seen).toEqual({ count: 2, open: false })
  })
})

describe('the write queue', () => {
  it('runs writes in call order even when none is awaited', async () => {
    const results = await Promise.all([
      storage.insertTransaction(tx({ note: 'a1' })),
      storage.insertTransaction(tx({ note: 'a2' })),
      storage.insertTransaction(tx({ note: 'a3' })),
      storage.clearAll(),
      storage.insertTransaction(tx({ note: 'b1' })),
      storage.insertTransaction(tx({ note: 'b2' })),
    ])

    expect(results.filter(Boolean).map((item) => item.id)).toEqual([
      1, 2, 3, 4, 5,
    ])
    const { transactions } = await storage.loadAll()
    // the ids keep counting after the clear (AUTOINCREMENT)
    expect(transactions.map((item) => [item.id, item.note])).toEqual([
      [4, 'b1'],
      [5, 'b2'],
    ])
    await noPending()
  })

  it('runs a read queued behind writes after them', async () => {
    const [, , state] = await Promise.all([
      storage.insertTransaction(tx({ note: 'a' })),
      storage.insertTransactions([tx({ note: 'b' }), tx({ note: 'c' })]),
      storage.loadAll(),
    ])

    expect(state.transactions.map((item) => item.note)).toEqual(['a', 'b', 'c'])
  })

  it('does not let a rejected write block the ones queued after it', async () => {
    const results = await Promise.allSettled([
      storage.insertTransaction(tx({ note: 'ok1' })),
      storage.insertTransactions([tx({ note: 'x' }), tx({ amount: 0 })]),
      storage.insertTransaction(tx({ amount: 0 })),
      storage.insertTransaction(tx({ note: 'ok2' })),
    ])

    expect(results.map((r) => r.status)).toEqual([
      'fulfilled',
      'rejected',
      'rejected',
      'fulfilled',
    ])
    const { transactions } = await storage.loadAll()
    expect(transactions.map((item) => item.note)).toEqual(['ok1', 'ok2'])
    await noPending()
  })
})

describe('legacy import from localStorage', () => {
  const legacy = {
    categories: [
      { id: 7, name: 'Pets', color: 'cyan' },
      { id: 8, name: 'Gifts' },
    ],
    transactions: [
      { id: 5, amount: 9.99, currency: 'USD', type: 'expense', categoryId: 7, note: 'Cat', date: '2026-10-06' },
      { id: 9, amount: 250000, currency: 'CRC', type: 'income', categoryId: null, note: 'Pay', date: '2026-10-01' },
      { id: 12, amount: 500, currency: 'CRC', type: 'expense', categoryId: 99, note: 'Lost', date: '2026-10-02' },
      { id: 13, amount: 0, currency: 'CRC', type: 'expense', categoryId: 1, note: 'Invalid', date: '2026-10-02' },
    ],
  }

  it('copies a saved blob once, keeps ids, sets the flag and leaves the blob alone', async () => {
    const blob = JSON.stringify(legacy)
    const store = new Map([['finance-data', blob]])
    const setItem = vi.fn((key, value) => store.set(key, String(value)))
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem,
    }

    try {
      const first = await storage.loadAll()

      expect(first.categories).toEqual([
        ...builtIn,
        { id: 7, name: 'Pets', color: 'cyan' },
        // no valid color saved: gets one by its position
        { id: 8, name: 'Gifts', color: 'slate' },
      ])
      expect(first.transactions).toEqual([
        { id: 5, amount: 9.99, currency: 'USD', type: 'expense', categoryId: 7, note: 'Cat', date: '2026-10-06', paymentMethod: 'cash' },
        { id: 9, amount: 250000, currency: 'CRC', type: 'income', categoryId: null, note: 'Pay', date: '2026-10-01', paymentMethod: 'cash' },
        // an unknown category becomes none; the invalid row is dropped
        { id: 12, amount: 500, currency: 'CRC', type: 'expense', categoryId: null, note: 'Lost', date: '2026-10-02', paymentMethod: 'cash' },
      ])
      expect(store.get('finance-data-imported')).toBe('1')
      expect(store.get('finance-data')).toBe(blob)
      expect(setItem).toHaveBeenCalledTimes(1)
      expect(current.persist).toHaveBeenCalledTimes(1)

      // a second load reads the database and imports nothing
      await storage.clearAll()
      current.persist.mockClear()
      const second = await storage.loadAll()
      expect(second.transactions).toEqual([])
      expect(second.categories).toEqual(builtIn)
      expect(current.persist).not.toHaveBeenCalled()
      expect(store.get('finance-data')).toBe(blob)
    } finally {
      delete globalThis.localStorage
    }
  })

  it('does not import into a database that already has data', async () => {
    const store = new Map([['finance-data', JSON.stringify(legacy)]])
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    }

    try {
      await storage.insertTransaction(tx({ note: 'already here' }))

      const state = await storage.loadAll()

      expect(state.transactions.map((item) => item.note)).toEqual([
        'already here',
      ])
      expect(state.categories).toEqual(builtIn)
      expect(store.get('finance-data-imported')).toBe('1')
    } finally {
      delete globalThis.localStorage
    }
  })
})

describe('amount guard', () => {
  it.each([Infinity, NaN, 1e308, 9e15, 1_000_000_001, 0, -5, 0.001])(
    'refuses to save an amount of %s anywhere',
    async (amount) => {
      await expect(storage.insertTransaction(tx({ amount }))).rejects.toThrow()
      await expect(storage.insertTransactions([tx({ amount })])).rejects.toThrow()
      await expect(storage.insertSavingsMove(move({ amount }))).rejects.toThrow()
      await expect(
        storage.insertIncomeWithSavings(tx({ type: 'income', categoryId: null }), move({ amount })),
      ).rejects.toThrow()
      await expect(
        storage.insertRecurring(recurringItem({ amount })),
      ).rejects.toThrow()
      await expect(
        storage.restoreAll({
          categories: [],
          transactions: [{ id: 1, ...tx({ amount }) }],
          budgets: [],
          recurring: [],
          savings: [],
        }),
      ).rejects.toThrow()
      expect(await rows('SELECT * FROM transactions')).toEqual([])
      expect(await rows('SELECT * FROM savings')).toEqual([])
      await noPending()
    },
  )

  it('refuses a budget above the cap', async () => {
    await expect(storage.setBudget(1, 'CRC', 1e300)).rejects.toThrow()
    await expect(storage.setBudget(1, 'CRC', Infinity)).rejects.toThrow()
    expect(await rows('SELECT * FROM budgets')).toEqual([])
  })

  it('keeps the old data when a restore fails on a bad amount', async () => {
    await storage.insertTransaction(tx({ note: 'keep me' }))
    await expect(
      storage.restoreAll({
        categories: [],
        transactions: [{ id: 5, ...tx({ amount: 1e308 }) }],
        budgets: [],
        recurring: [],
        savings: [],
      }),
    ).rejects.toThrow()
    const state = await storage.loadAll()
    expect(state.transactions.map((item) => item.note)).toEqual(['keep me'])
  })

  it('saves an amount at the cap', async () => {
    const saved = await storage.insertTransaction(tx({ amount: 1_000_000_000 }))
    expect(saved.amount).toBe(1_000_000_000)
    expect((await storage.loadAll()).transactions[0].amount).toBe(1_000_000_000)
  })

  it('skips legacy transactions with an amount or id out of range', async () => {
    globalThis.localStorage = {
      getItem: (key) =>
        key === 'finance-data'
          ? JSON.stringify({
              transactions: [
                { id: 1, amount: 1e308, type: 'expense', currency: 'CRC', date: '2026-10-01' },
                { id: 2 ** 40, amount: 5, type: 'expense', currency: 'CRC', date: '2026-10-01' },
                { id: 3, amount: 5, type: 'expense', currency: 'CRC', date: '2026-10-01' },
              ],
            })
          : null,
      setItem: () => {},
    }
    try {
      const state = await storage.loadAll()
      expect(state.transactions.map((item) => item.id)).toEqual([3])
    } finally {
      delete globalThis.localStorage
    }
  })
})

describe('a save that cannot be persisted', () => {
  // On web the write is in memory until persist() reaches IndexedDB. When
  // that fails the write is undone, so retrying cannot leave two copies.
  const failOnce = () =>
    current.persist.mockRejectedValueOnce(new Error('QuotaExceededError'))

  it('does not leave a phantom transaction, so a retry saves it once', async () => {
    failOnce()
    await expect(storage.insertTransaction(tx({ note: 'a' }))).rejects.toThrow('Quota')
    expect(await rows('SELECT * FROM transactions')).toEqual([])

    await storage.insertTransaction(tx({ note: 'a' }))
    const { transactions } = await storage.loadAll()
    expect(transactions.map((item) => item.note)).toEqual(['a'])
  })

  it('undoes a batch, a category, a recurring item and a savings move', async () => {
    failOnce()
    await expect(storage.insertTransactions([tx(), tx()])).rejects.toThrow()
    failOnce()
    await expect(
      storage.insertCategory({ name: 'Pets', color: 'cyan' }),
    ).rejects.toThrow()
    failOnce()
    await expect(storage.insertRecurring(recurringItem())).rejects.toThrow()
    failOnce()
    await expect(storage.insertSavingsMove(move())).rejects.toThrow()

    const state = await storage.loadAll()
    expect(state.transactions).toEqual([])
    expect(state.categories).toEqual(builtIn)
    expect(state.recurring).toEqual([])
    expect(state.savings).toEqual([])
    await noPending()
  })

  it('undoes an income with savings as a whole', async () => {
    failOnce()
    await expect(
      storage.insertIncomeWithSavings(
        tx({ type: 'income', categoryId: null, amount: 1000 }),
        move({ amount: 300 }),
      ),
    ).rejects.toThrow()
    const state = await storage.loadAll()
    expect(state.transactions).toEqual([])
    expect(state.savings).toEqual([])
  })

  it('puts a confirmed recurring item back as it was', async () => {
    const item = await storage.insertRecurring(recurringItem())
    await storage.skipRecurring(item.id, '2026-09-2')
    failOnce()
    await expect(
      storage.confirmRecurring(item.id, '2026-10-1', tx()),
    ).rejects.toThrow()

    const state = await storage.loadAll()
    expect(state.transactions).toEqual([])
    expect(state.recurring[0].lastPeriod).toBe('2026-09-2')

    await storage.confirmRecurring(item.id, '2026-10-1', tx())
    const after = await storage.loadAll()
    expect(after.transactions).toHaveLength(1)
    expect(after.recurring[0].lastPeriod).toBe('2026-10-1')
  })

  it('keeps working for the writes after it', async () => {
    failOnce()
    await expect(storage.insertTransaction(tx())).rejects.toThrow()
    const saved = await storage.insertTransaction(tx({ note: 'ok' }))
    expect(saved.note).toBe('ok')
    await noPending()
  })
})
