import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runMigrations } from './migrations'
import { createTestDb } from './testDb'
import { getTotals } from '../lib/money'

// Same setup as storage.test.js: storage.js gets its connection from a mock
const current = vi.hoisted(() => ({ db: null, persist: null }))

vi.mock('./database', () => ({
  getDb: () => Promise.resolve(current.db),
  persist: (...args) => current.persist(...args),
}))

let storage

beforeEach(async () => {
  current.db = await createTestDb()
  await runMigrations(current.db)
  current.persist = vi.fn().mockResolvedValue(undefined)
  vi.resetModules()
  storage = await import('./storage')
})

const rows = async (sql, params) => (await current.db.query(sql, params)).values

const income = (changes = {}) => ({
  amount: 250000,
  currency: 'CRC',
  type: 'income',
  categoryId: null,
  note: 'Pay',
  date: '2026-10-01',
  paymentMethod: 'sinpe',
  source: 'salary',
  ...changes,
})
const expense = (changes = {}) => ({ ...income(), type: 'expense', categoryId: 1, source: null, ...changes })
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

describe('income source', () => {
  it('saves and reads the source of an income', async () => {
    const saved = await storage.insertTransaction(income({ source: 'freelance' }))
    expect(saved.source).toBe('freelance')
    expect(await rows('SELECT source FROM transactions')).toEqual([{ source: 'freelance' }])
    expect((await storage.loadAll()).transactions[0].source).toBe('freelance')
  })

  it('keeps null for an expense, an income without one and an unknown value', async () => {
    const a = await storage.insertTransaction(expense({ source: 'salary' }))
    const b = await storage.insertTransaction(income({ source: undefined }))
    const c = await storage.insertTransaction(income({ source: 'lottery' }))
    expect([a.source, b.source, c.source]).toEqual([null, null, null])
    expect(await rows('SELECT source FROM transactions ORDER BY id')).toEqual([
      { source: null },
      { source: null },
      { source: null },
    ])
  })

  it('updates the source, and clears it when the income becomes an expense', async () => {
    const { id } = await storage.insertTransaction(income({ source: 'gift' }))
    await storage.updateTransaction(id, income({ source: 'other' }))
    expect((await storage.loadAll()).transactions[0].source).toBe('other')
    await storage.updateTransaction(id, expense({ source: 'other' }))
    expect((await storage.loadAll()).transactions[0].source).toBeNull()
  })

  it('saves it with the several-at-once insert and with an income plus savings', async () => {
    const list = await storage.insertTransactions([income({ source: 'gift' }), expense()])
    expect(list.map((tx) => tx.source)).toEqual(['gift', null])
    const both = await storage.insertIncomeWithSavings(income({ source: 'salary' }), move())
    expect(both.transaction.source).toBe('salary')
    expect((await storage.loadAll()).transactions.map((tx) => tx.source)).toEqual([
      'gift',
      null,
      'salary',
    ])
  })

  it('restores sources from a backup, and none for data without them', async () => {
    const base = {
      categories: [],
      budgets: [],
      recurring: [],
      savings: [],
      transactions: [
        { ...income({ source: 'gift' }), id: 4 },
        { ...expense(), id: 5, source: undefined },
      ],
    }
    const restored = await storage.restoreAll(base)
    expect(restored.transactions.map((tx) => tx.source)).toEqual(['gift', null])
  })
})

describe('savings goals', () => {
  it('inserts, reads (in cents and back), updates and deletes', async () => {
    const { goal: saved, status } = await storage.insertGoal(goal({ target: 99.99 }))
    expect(status).toBe('confirmed')
    expect(saved).toEqual({ ...goal({ target: 99.99 }), id: 1 })
    expect(await rows('SELECT * FROM goals')).toEqual([
      {
        id: 1,
        name: 'Trip',
        target_cents: 9999,
        currency: 'CRC',
        created_at: '2026-09-01',
        achieved_at: null,
      },
    ])
    expect((await storage.loadAll()).goals).toEqual([saved])

    const updated = await storage.updateGoal(1, goal({ name: 'Car', target: 500, currency: 'USD' }))
    expect(updated.goal).toEqual({ ...goal({ name: 'Car', target: 500, currency: 'USD' }), id: 1 })
    expect((await storage.loadAll()).goals).toEqual([updated.goal])

    await storage.deleteGoal(1)
    expect((await storage.loadAll()).goals).toEqual([])
  })

  it('defaults createdAt to today and trims the name', async () => {
    const { goal: saved } = await storage.insertGoal({
      name: '  Trip  ',
      target: 5,
      currency: 'USD',
    })
    expect(saved.name).toBe('Trip')
    expect(saved.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(saved.achievedAt).toBeNull()
  })

  it('refuses invalid goals before writing anything', async () => {
    for (const bad of [
      goal({ name: '' }),
      goal({ name: '   ' }),
      goal({ target: 0 }),
      goal({ target: -1 }),
      goal({ target: 1_000_000_001 }),
      goal({ target: NaN }),
      goal({ currency: 'EUR' }),
    ]) {
      await expect(storage.insertGoal(bad)).rejects.toThrow()
    }
    await expect(storage.insertGoal(goal({ id: 1.5 }))).rejects.toThrow()
    await expect(storage.insertGoal(goal({ id: -3 }))).rejects.toThrow()
    expect(await rows('SELECT * FROM goals')).toEqual([])
  })

  it('cannot update a goal that does not exist', async () => {
    await expect(storage.updateGoal(99, goal())).rejects.toThrow('Goal not found')
  })

  it('saving the same goal id twice leaves one row (a retry)', async () => {
    const id = 1_800_000_000_000_123
    await storage.insertGoal(goal({ id }))
    await storage.insertGoal(goal({ id, name: 'Trip (retry)' }))
    expect(await rows('SELECT id, name FROM goals')).toEqual([{ id, name: 'Trip (retry)' }])
  })

  it('undoes the insert if the copy to IndexedDB fails', async () => {
    current.persist.mockRejectedValueOnce(new Error('disk full'))
    await expect(storage.insertGoal(goal())).rejects.toThrow('disk full')
    expect(await rows('SELECT * FROM goals')).toEqual([])
  })

  it('undoes an update if the copy fails', async () => {
    const { goal: saved } = await storage.insertGoal(goal())
    current.persist.mockRejectedValueOnce(new Error('disk full'))
    await expect(storage.updateGoal(saved.id, goal({ name: 'Other' }))).rejects.toThrow()
    expect((await storage.loadAll()).goals).toEqual([saved])
  })

  it('goes away with clearAll and comes back with restoreAll', async () => {
    await storage.insertGoal(goal({ achievedAt: '2026-10-01' }))
    const state = await storage.loadAll()
    await storage.clearAll()
    expect((await storage.loadAll()).goals).toEqual([])

    const { goals, ...rest } = state
    const base = { ...rest, categories: [] }
    const restored = await storage.restoreAll({ ...base, goals })
    expect(restored.goals).toEqual(goals)
    expect(restored.goals[0].achievedAt).toBe('2026-10-01')
    // a backup without the list (an older one) leaves none
    const again = await storage.restoreAll(base)
    expect(again.goals).toEqual([])
  })
})

describe('savings moves with an id made by the caller', () => {
  it('saves a move under that id and returns it', async () => {
    const id = 1_800_000_000_000_001
    const { move: saved, status, achievedGoalIds } = await storage.saveSavingsMove(move({ id }))
    expect(saved.id).toBe(id)
    expect(status).toBe('confirmed')
    expect(achievedGoalIds).toEqual([])
    expect(await rows('SELECT id, amount_cents FROM savings')).toEqual([
      { id, amount_cents: 600000 },
    ])
  })

  it('writes the same id twice as one row (a retry does not duplicate)', async () => {
    const id = 1_800_000_000_000_002
    await storage.saveSavingsMove(move({ id }))
    await storage.saveSavingsMove(move({ id }))
    await storage.insertSavingsMove(move({ id }))
    expect(await rows('SELECT id FROM savings')).toEqual([{ id }])
    expect((await storage.loadAll()).savings).toHaveLength(1)
  })

  it('still numbers moves without an id, as before', async () => {
    const first = await storage.insertSavingsMove(move())
    const second = await storage.insertSavingsMove(move())
    expect([first.id, second.id]).toEqual([1, 2])
  })

  it('a different id is a different move', async () => {
    await storage.saveSavingsMove(move({ id: 50 }))
    await storage.saveSavingsMove(move({ id: 51 }))
    expect(await rows('SELECT id FROM savings ORDER BY id')).toEqual([{ id: 50 }, { id: 51 }])
  })

  it('refuses an id that is not a positive safe integer', async () => {
    for (const bad of [0, -1, 1.5, '7', Number.MAX_SAFE_INTEGER + 2]) {
      await expect(storage.saveSavingsMove(move({ id: bad }))).rejects.toThrow(
        'Invalid savings move id',
      )
    }
    expect(await rows('SELECT * FROM savings')).toEqual([])
  })

  it('undoes the write if the copy fails, and restores a row it replaced', async () => {
    current.persist.mockRejectedValueOnce(new Error('disk full'))
    await expect(storage.saveSavingsMove(move({ id: 70 }))).rejects.toThrow('disk full')
    expect(await rows('SELECT * FROM savings')).toEqual([])

    await storage.saveSavingsMove(move({ id: 71, amount: 1 }))
    current.persist.mockRejectedValueOnce(new Error('disk full'))
    await expect(storage.saveSavingsMove(move({ id: 71, amount: 2 }))).rejects.toThrow()
    expect(await rows('SELECT amount_cents FROM savings')).toEqual([{ amount_cents: 100 }])
  })
})

describe('goals reached by a deposit', () => {
  it('marks them in the same transaction as the deposit', async () => {
    const { goal: g1 } = await storage.insertGoal(goal({ target: 5000 }))
    const { goal: g2 } = await storage.insertGoal(goal({ target: 50000 }))
    const result = await storage.saveSavingsMove(move({ id: 10 }), {
      achieveGoalIds: [g1.id],
      achievedAt: '2026-10-24',
    })
    expect(result.achievedGoalIds).toEqual([g1.id])
    const state = await storage.loadAll()
    expect(state.goals.find((g) => g.id === g1.id).achievedAt).toBe('2026-10-24')
    expect(state.goals.find((g) => g.id === g2.id).achievedAt).toBeNull()
    expect(state.savings).toHaveLength(1)
  })

  it('does not touch a goal that was already achieved', async () => {
    const { goal: saved } = await storage.insertGoal(goal({ achievedAt: '2026-09-15' }))
    const result = await storage.saveSavingsMove(move({ id: 10 }), {
      achieveGoalIds: [saved.id],
      achievedAt: '2026-10-24',
    })
    expect(result.achievedGoalIds).toEqual([])
    expect((await storage.loadAll()).goals[0].achievedAt).toBe('2026-09-15')
  })

  it('a withdrawal never marks (or clears) a goal', async () => {
    const { goal: reached } = await storage.insertGoal(goal({ achievedAt: '2026-09-15' }))
    const { goal: open } = await storage.insertGoal(goal({ target: 1 }))
    await storage.saveSavingsMove(move({ id: 1, amount: 9000 }))
    const result = await storage.saveSavingsMove(
      move({ id: 2, direction: 'out', amount: 8999 }),
      { achieveGoalIds: [open.id], achievedAt: '2026-10-24' },
    )
    expect(result.achievedGoalIds).toEqual([])
    const goals = (await storage.loadAll()).goals
    expect(goals.find((g) => g.id === reached.id).achievedAt).toBe('2026-09-15')
    expect(goals.find((g) => g.id === open.id).achievedAt).toBeNull()
  })

  it('retrying the same deposit does not mark twice or move the date', async () => {
    const { goal: saved } = await storage.insertGoal(goal({ target: 5000 }))
    const options = { achieveGoalIds: [saved.id], achievedAt: '2026-10-24' }
    await storage.saveSavingsMove(move({ id: 10 }), options)
    const retry = await storage.saveSavingsMove(move({ id: 10 }), {
      ...options,
      achievedAt: '2026-10-25',
    })
    expect(retry.achievedGoalIds).toEqual([])
    expect((await storage.loadAll()).goals[0].achievedAt).toBe('2026-10-24')
    expect(await rows('SELECT id FROM savings')).toEqual([{ id: 10 }])
  })

  it('writes nothing, deposit or goal, if the deposit is invalid', async () => {
    const { goal: saved } = await storage.insertGoal(goal({ target: 5000 }))
    await expect(
      storage.saveSavingsMove(move({ id: 10, amount: 0 }), { achieveGoalIds: [saved.id] }),
    ).rejects.toThrow('Invalid amount')
    expect(await rows('SELECT * FROM savings')).toEqual([])
    expect((await storage.loadAll()).goals[0].achievedAt).toBeNull()
  })

  it('puts the goal back if the copy to IndexedDB fails', async () => {
    const { goal: saved } = await storage.insertGoal(goal({ target: 5000 }))
    current.persist.mockRejectedValueOnce(new Error('disk full'))
    await expect(
      storage.saveSavingsMove(move({ id: 10 }), {
        achieveGoalIds: [saved.id],
        achievedAt: '2026-10-24',
      }),
    ).rejects.toThrow('disk full')
    expect(await rows('SELECT * FROM savings')).toEqual([])
    expect((await storage.loadAll()).goals[0].achievedAt).toBeNull()
  })

  it('also marks them when the deposit comes with an income', async () => {
    const { goal: saved } = await storage.insertGoal(goal({ target: 5000 }))
    const result = await storage.insertIncomeWithSavings(income(), move({ id: 12 }), {
      achieveGoalIds: [saved.id],
      achievedAt: '2026-10-24',
    })
    expect(result.achievedGoalIds).toEqual([saved.id])
    expect(result.move.id).toBe(12)
    expect(result.status).toBe('confirmed')
    expect((await storage.loadAll()).goals[0].achievedAt).toBe('2026-10-24')
  })
})

describe('savings moves are transfers', () => {
  it('never become income or expenses', async () => {
    await storage.insertTransaction(income({ amount: 1000 }))
    await storage.insertTransaction(expense({ amount: 400 }))
    await storage.saveSavingsMove(move({ id: 1, amount: 300 }))
    await storage.saveSavingsMove(move({ id: 2, direction: 'out', amount: 100 }))
    expect(await rows('SELECT COUNT(*) AS n FROM transactions')).toEqual([{ n: 2 }])
    const state = await storage.loadAll()
    expect(getTotals(state.transactions, 'CRC')).toMatchObject({
      income: 1000,
      spent: 400,
      net: 600,
    })
  })
})
