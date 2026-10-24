import { describe, expect, it } from 'vitest'
import {
  MAX_BACKUP_BYTES,
  MAX_ID,
  MAX_RECORDS,
  buildBackup,
  inspectBackup,
  backupSnoozeUntil,
  isBackupDue,
  isBackupReminderSnoozed,
  isBackupReminderDue,
  summarizeCounts,
} from './backup'
import { DEFAULT_SCHEDULE } from './quincenaSchedule'

const builtIn = [
  { id: 1, key: 'food', color: 'orange' },
  { id: 2, key: 'transport', color: 'blue' },
  { id: 3, key: 'bills', color: 'violet' },
  { id: 4, key: 'fun', color: 'lime' },
]
const now = new Date('2026-10-12T15:30:00Z')

const state = {
  categories: [...builtIn, { id: 7, name: 'Mascotas', color: 'cyan' }],
  transactions: [
    { id: 1, amount: 250000, currency: 'CRC', type: 'income', categoryId: null, note: 'Pay', date: '2026-10-01', paymentMethod: 'sinpe', source: 'salary' },
    { id: 2, amount: 8500.5, currency: 'CRC', type: 'expense', categoryId: 1, note: 'Lunch', date: '2026-10-02', paymentMethod: 'cash', source: null },
    { id: 3, amount: 9.99, currency: 'USD', type: 'expense', categoryId: 7, note: '', date: '2026-10-06', paymentMethod: 'card', source: null },
  ],
  budgets: [
    { categoryId: 1, currency: 'CRC', amount: 50000 },
    { categoryId: 7, currency: 'USD', amount: 20 },
  ],
  recurring: [
    { id: 1, amount: 45000, currency: 'CRC', type: 'expense', categoryId: 3, note: 'Rent', schedule: 'first', lastPeriod: '2026-10-1' },
    { id: 2, amount: 100, currency: 'USD', type: 'income', categoryId: null, note: '', schedule: 'every', lastPeriod: null },
  ],
  savings: [
    { id: 1, amount: 20000, currency: 'CRC', direction: 'in', note: 'Trip', date: '2026-10-01' },
    { id: 2, amount: 5.5, currency: 'USD', direction: 'out', note: '', date: '2026-10-05' },
  ],
  goals: [
    { id: 1, name: 'Trip', target: 500000, currency: 'CRC', createdAt: '2026-09-01', achievedAt: null },
    { id: 2, name: 'Laptop', target: 800, currency: 'USD', createdAt: '2026-09-02', achievedAt: '2026-10-05' },
  ],
}

const validTx = state.transactions[1]
const validBudget = state.budgets[0]
const validRecurring = state.recurring[0]
const validMove = state.savings[0]

// A backup file with the given lists replaced
const file = (changes = {}) =>
  JSON.stringify({ ...buildBackup(state, now), ...changes })
// The restored data of a backup text, or null when it is not a usable backup
const parseBackup = (text, builtInCategories) => {
  const result = inspectBackup(text, builtInCategories)
  return result.ok ? result.data : null
}
const parse = (changes) => parseBackup(file(changes), builtIn)

describe('buildBackup', () => {
  it('leaves out built-in categories and stamps app, version and date', () => {
    const backup = buildBackup(state, now)
    expect(backup.app).toBe('quincena')
    expect(backup.version).toBe(1)
    expect(backup.exportedAt).toBe('2026-10-12T15:30:00.000Z')
    expect(backup.categories).toEqual([{ id: 7, name: 'Mascotas', color: 'cyan' }])
    expect(backup.transactions).toEqual(state.transactions)
    expect(backup.budgets).toEqual(state.budgets)
    expect(backup.recurring).toEqual(state.recurring)
    expect(backup.savings).toEqual(state.savings)
  })

  it('writes an empty savings list when the state has none', () => {
    const withoutSavings = { ...state, savings: undefined }
    expect(buildBackup(withoutSavings, now).savings).toEqual([])
  })
})

describe('inspectBackup data', () => {
  it('round-trips a realistic state unchanged', () => {
    const result = parseBackup(file(), builtIn)
    expect(result).toEqual({
      categories: [{ id: 7, name: 'Mascotas', color: 'cyan' }],
      transactions: state.transactions,
      budgets: state.budgets,
      recurring: state.recurring,
      savings: state.savings,
      goals: state.goals,
      quincenaSchedule: DEFAULT_SCHEDULE,
    })
  })

  describe('quincena schedule', () => {
    const custom = [
      { from: '2000-01-01', mode: 'fixed', day1: 1, day2: 16 },
      { from: '2026-10-16', mode: 'paydays', day1: 5, day2: 20 },
    ]

    it('is written to the backup and read back', () => {
      const backup = buildBackup({ ...state, quincenaSchedule: custom }, now)
      expect(backup.quincenaSchedule).toEqual(custom)
      expect(backup.version).toBe(1)
      const result = parseBackup(JSON.stringify(backup), builtIn)
      expect(result.quincenaSchedule).toEqual(custom)
    })

    it('reads an old backup without it as 15/30', () => {
      const old = JSON.parse(file())
      delete old.quincenaSchedule
      const result = parseBackup(JSON.stringify(old), builtIn)
      expect(result).not.toBeNull()
      expect(result.quincenaSchedule).toEqual(DEFAULT_SCHEDULE)
      expect(result.transactions).toEqual(state.transactions)
    })

    it('reads a damaged one as 15/30 and does not count it in the lists', () => {
      for (const bad of [null, 'x', 5, [], [{ mode: 'weekly' }], {}]) {
        const inspected = inspectBackup(file({ quincenaSchedule: bad }), builtIn)
        expect(inspected.ok).toBe(true)
        expect(inspected.data.quincenaSchedule).toEqual(DEFAULT_SCHEDULE)
        expect(Object.keys(inspected.counts)).toEqual([
          'categories',
          'transactions',
          'budgets',
          'recurring',
          'savings',
          'goals',
        ])
      }
    })

    it('keeps the "handled in" mark of a recurring item made with pay days', () => {
      const item = { ...validRecurring, lastPeriod: '2026-10-05' }
      const result = parse({ recurring: [item] })
      expect(result.recurring[0].lastPeriod).toBe('2026-10-05')
    })
  })

  it('keeps the payment method of each transaction', () => {
    const result = parseBackup(file(), builtIn)
    expect(result.transactions.map((tx) => tx.paymentMethod)).toEqual([
      'sinpe',
      'cash',
      'card',
    ])
  })

  it('reads an older backup without a payment method as cash', () => {
    const old = JSON.parse(file())
    for (const tx of old.transactions) delete tx.paymentMethod
    const result = parseBackup(JSON.stringify(old), builtIn)
    expect(result.transactions.map((tx) => tx.paymentMethod)).toEqual([
      'cash',
      'cash',
      'cash',
    ])
  })

  it('reads an unknown payment method as cash and keeps the record', () => {
    const odd = JSON.parse(file())
    odd.transactions[0].paymentMethod = 'bitcoin'
    const result = inspectBackup(JSON.stringify(odd), builtIn)
    expect(result.ok).toBe(true)
    expect(result.droppedTotal).toBe(0)
    expect(result.data.transactions[0].paymentMethod).toBe('cash')
  })

  it('reads an older backup without savings as an empty list', () => {
    const old = JSON.parse(file())
    delete old.savings
    const result = parseBackup(JSON.stringify(old), builtIn)
    expect(result).not.toBeNull()
    expect(result.savings).toEqual([])
    expect(result.transactions).toEqual(state.transactions)
  })

  it('rejects a backup whose savings is not an array', () => {
    expect(parse({ savings: 'x' })).toBeNull()
    expect(parse({ savings: {} })).toBeNull()
    expect(parse({ savings: null })).toBeNull()
    expect(parse({ savings: 5 })).toBeNull()
  })

  it('drops invalid savings moves and keeps the valid ones', () => {
    const bad = [
      { ...validMove, id: 1.5 },
      { ...validMove, id: 0 },
      { ...validMove, id: 11, amount: 0 },
      { ...validMove, id: 12, amount: -5 },
      { ...validMove, id: 13, amount: 0.001 },
      { ...validMove, id: 14, amount: '10' },
      { ...validMove, id: 15, currency: 'EUR' },
      { ...validMove, id: 16, direction: 'up' },
      { ...validMove, id: 17, direction: undefined },
      { ...validMove, id: 18, date: '2026-02-31' },
      { ...validMove, id: 19, date: 20261012 },
      null,
      5,
    ]
    const result = parse({ savings: [validMove, ...bad] })
    expect(result.savings).toEqual([validMove])
  })

  it('cleans the note of a savings move and keeps exactly six fields', () => {
    const result = parse({
      savings: [
        { ...validMove, id: 1, note: undefined, extra: 'x' },
        { ...validMove, id: 2, note: 5 },
      ],
    })
    expect(result.savings.map((m) => m.note)).toEqual(['', ''])
    expect(Object.keys(result.savings[0])).toHaveLength(6)
  })

  it('returns null when the text is not an I AM POOR FOR NOW backup', () => {
    expect(parseBackup('not json', builtIn)).toBeNull()
    expect(parseBackup('', builtIn)).toBeNull()
    expect(parseBackup('null', builtIn)).toBeNull()
    expect(parseBackup('[]', builtIn)).toBeNull()
    expect(parseBackup('5', builtIn)).toBeNull()
    expect(parse({ app: 'other' })).toBeNull()
    expect(parse({ version: 2 })).toBeNull()
    expect(parse({ transactions: undefined })).toBeNull()
    expect(parse({ categories: 'x' })).toBeNull()
    expect(parse({ budgets: {} })).toBeNull()
    expect(parse({ recurring: null })).toBeNull()
  })

  it('never throws, whatever the input', () => {
    expect(parseBackup(null, builtIn)).toBeNull()
    expect(parseBackup(undefined, builtIn)).toBeNull()
    expect(parseBackup(42, builtIn)).toBeNull()
    const garbage = [null, 5, 'x', [], undefined, true]
    const result = parse({
      categories: garbage,
      transactions: [...garbage, { id: 1, date: ['2026-10-12'] }],
      budgets: garbage,
      goals: garbage,
      recurring: garbage,
      savings: garbage,
    })
    expect(result).toEqual({
      categories: [],
      transactions: [],
      budgets: [],
      recurring: [],
      savings: [],
      goals: [],
      quincenaSchedule: DEFAULT_SCHEDULE,
    })
  })

  it('drops invalid custom categories', () => {
    const good = { id: 7, name: 'Mascotas', color: 'cyan' }
    const result = parse({
      categories: [
        good,
        { id: 2, name: 'Clash', color: 'cyan' },
        { id: 1.5, name: 'Float', color: 'cyan' },
        { id: 8, name: '   ', color: 'cyan' },
        { id: 9, name: 5, color: 'cyan' },
        { id: 10, name: 'Bad color', color: 'pink' },
      ],
    })
    expect(result.categories).toEqual([good])
  })

  it('drops invalid transactions and keeps the valid ones', () => {
    const bad = [
      { ...validTx, id: 1.5 },
      { ...validTx, id: 11, amount: 0 },
      { ...validTx, id: 12, amount: -5 },
      { ...validTx, id: 13, amount: 0.001 },
      { ...validTx, id: 14, amount: '10' },
      { ...validTx, id: 15, amount: Infinity },
      { ...validTx, id: 16, currency: 'EUR' },
      { ...validTx, id: 17, type: 'transfer' },
      { ...validTx, id: 18, date: '2026-02-31' },
      { ...validTx, id: 19, date: 20261012 },
    ]
    const result = parse({ transactions: [validTx, ...bad] })
    expect(result.transactions).toEqual([validTx])
  })

  it('cleans the note and the category of a transaction', () => {
    const result = parse({
      transactions: [
        { ...validTx, id: 1, note: undefined },
        { ...validTx, id: 2, note: 5 },
        { ...validTx, id: 3, categoryId: 99 },
        { ...validTx, id: 4, categoryId: 7 },
        { ...validTx, id: 5, type: 'income', categoryId: 1 },
      ],
    })
    expect(result.transactions.map((x) => x.note)).toEqual(['', '', 'Lunch', 'Lunch', 'Lunch'])
    expect(result.transactions.map((x) => x.categoryId)).toEqual([1, 1, null, 7, null])
    expect(Object.keys(result.transactions[0])).toHaveLength(9)
  })

  it('drops budgets that are invalid or point to an unknown category', () => {
    const result = parse({
      budgets: [
        validBudget,
        { categoryId: 99, currency: 'CRC', amount: 10 },
        { categoryId: 7, currency: 'EUR', amount: 10 },
        { categoryId: 1, currency: 'USD', amount: 0 },
        { categoryId: 1, currency: 'USD', amount: 'x' },
        { currency: 'USD', amount: 10 },
      ],
    })
    expect(result.budgets).toEqual([validBudget])
  })

  it('drops budgets of a custom category that was not in the file', () => {
    const result = parse({ categories: [] })
    expect(result.budgets).toEqual([validBudget])
    expect(result.transactions.find((x) => x.id === 3).categoryId).toBeNull()
  })

  it('drops invalid recurring items and cleans lastPeriod', () => {
    const result = parse({
      recurring: [
        validRecurring,
        { ...validRecurring, id: 10, schedule: 'weekly' },
        { ...validRecurring, id: 11, amount: 0 },
        { ...validRecurring, id: 12, currency: 'EUR' },
        { ...validRecurring, id: 13, type: 'x' },
        { ...validRecurring, id: 14, categoryId: 99 },
        { ...validRecurring, id: 15, lastPeriod: '2026-10-3' },
        { ...validRecurring, id: 16, lastPeriod: 5 },
        { ...validRecurring, id: 17.5 },
      ],
    })
    expect(result.recurring.map((x) => x.id)).toEqual([1, 14, 15, 16])
    expect(result.recurring[1].categoryId).toBeNull()
    expect(result.recurring[2].lastPeriod).toBeNull()
    expect(result.recurring[3].lastPeriod).toBeNull()
    expect(Object.keys(result.recurring[0])).toHaveLength(8)
  })

  it('drops records whose id is not a positive safe integer', () => {
    const badIds = [0, -1, 2 ** 60, 1.5]
    const goodCategory = { id: 7, name: 'Mascotas', color: 'cyan' }
    const result = parse({
      categories: [
        goodCategory,
        ...badIds.map((id) => ({ id, name: 'Bad', color: 'cyan' })),
      ],
      transactions: [validTx, ...badIds.map((id) => ({ ...validTx, id }))],
      recurring: [validRecurring, ...badIds.map((id) => ({ ...validRecurring, id }))],
      savings: [validMove, ...badIds.map((id) => ({ ...validMove, id }))],
    })
    expect(result.categories).toEqual([goodCategory])
    expect(result.transactions).toEqual([validTx])
    expect(result.recurring).toEqual([validRecurring])
    expect(result.savings).toEqual([validMove])
  })

  it('keeps the first of any duplicate', () => {
    const result = parse({
      categories: [
        { id: 7, name: 'Mascotas', color: 'cyan' },
        { id: 7, name: 'Otra', color: 'sand' },
      ],
      transactions: [validTx, { ...validTx, note: 'Second' }],
      budgets: [validBudget, { ...validBudget, amount: 1 }],
      recurring: [validRecurring, { ...validRecurring, note: 'Second' }],
      savings: [validMove, { ...validMove, note: 'Second' }],
    })
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].name).toBe('Mascotas')
    expect(result.transactions).toEqual([validTx])
    expect(result.budgets).toEqual([validBudget])
    expect(result.recurring).toEqual([validRecurring])
    expect(result.savings).toEqual([validMove])
  })
})

describe('isBackupDue', () => {
  const today = new Date(2026, 9, 28)

  it('is due when there is no valid date', () => {
    expect(isBackupDue(null, today)).toBe(true)
    expect(isBackupDue('', today)).toBe(true)
    expect(isBackupDue('garbage', today)).toBe(true)
  })

  it('is not due for a backup made today', () => {
    expect(isBackupDue('2026-10-28', today)).toBe(false)
  })

  it('is not due at exactly 14 days, due at 15', () => {
    expect(isBackupDue('2026-10-14', today)).toBe(false)
    expect(isBackupDue('2026-10-13', today)).toBe(true)
  })

  it('is not due for a date in the future', () => {
    expect(isBackupDue('2026-11-15', today)).toBe(false)
  })

  it('accepts a custom number of days', () => {
    expect(isBackupDue('2026-10-21', today, 7)).toBe(false)
    expect(isBackupDue('2026-10-20', today, 7)).toBe(true)
  })
})

describe('isBackupReminderDue', () => {
  const today = new Date(2026, 9, 28)
  const tx = (date) => ({ date })

  it('follows the last backup when there is one', () => {
    expect(isBackupReminderDue('2026-10-20', [tx('2026-01-01')], today)).toBe(false)
    expect(isBackupReminderDue('2026-10-13', [tx('2026-10-20')], today)).toBe(true)
  })

  it('is not due with no transactions, whatever the last backup', () => {
    expect(isBackupReminderDue(null, [], today)).toBe(false)
    expect(isBackupReminderDue('2026-01-01', [], today)).toBe(false)
  })

  it('counts from the oldest transaction when there is no backup', () => {
    // with no backup at all it is sooner: after 7 days
    expect(isBackupReminderDue(null, [tx('2026-10-25')], today)).toBe(false)
    expect(isBackupReminderDue(null, [tx('2026-10-21')], today)).toBe(false)
    expect(isBackupReminderDue(null, [tx('2026-10-20')], today)).toBe(true)
  })

  it('uses the oldest of several transactions out of order', () => {
    const list = [tx('2026-10-27'), tx('2026-10-01'), tx('2026-10-20')]
    expect(isBackupReminderDue('garbage', list, today)).toBe(true)
  })
})

describe('limits of a restored backup', () => {
  const inspect = (changes) => inspectBackup(file(changes), builtIn)

  it.each([1e308, 9e15, 1e21, 1_000_000_001, Infinity, -5, 0, 0.001])(
    'drops an amount of %s',
    (amount) => {
      const result = inspect({
        transactions: [{ ...validTx, amount }, { ...validTx, id: 9 }],
        budgets: [{ ...validBudget, amount }],
        recurring: [{ ...validRecurring, amount }],
        savings: [{ ...validMove, amount }],
      })
      expect(result.ok).toBe(true)
      expect(result.data.transactions.map((tx) => tx.id)).toEqual([9])
      expect(result.data.budgets).toEqual([])
      expect(result.data.recurring).toEqual([])
      expect(result.data.savings).toEqual([])
    },
  )

  it('counts the notes and category names that were cut', () => {
    const result = inspect({
      transactions: [
        { ...validTx, note: 'x'.repeat(61) },
        { ...validTx, id: 9, note: 'short' },
      ],
      categories: [{ id: 50, name: 'N'.repeat(30), color: 'violet' }],
    })
    expect(result.trimmed).toBe(2)
    expect(result.data.transactions[0].note).toHaveLength(60)
  })

  it('does not count a cut text of a record that was dropped', () => {
    const result = inspect({
      transactions: [{ ...validTx, amount: -5, note: 'x'.repeat(61) }],
    })
    expect(result.trimmed).toBe(0)
  })

  it('keeps an amount at the cap', () => {
    const result = inspect({
      transactions: [{ ...validTx, amount: 1_000_000_000 }],
    })
    expect(result.data.transactions).toHaveLength(1)
  })

  it('rounds amounts to cents', () => {
    const result = inspect({ transactions: [{ ...validTx, amount: 10.126 }] })
    expect(result.data.transactions[0].amount).toBe(10.13)
  })

  it('drops ids above 2^31 - 1 and keeps the largest allowed', () => {
    const result = inspect({
      transactions: [
        { ...validTx, id: MAX_ID + 1 },
        { ...validTx, id: 9007199254740991 },
        { ...validTx, id: MAX_ID },
      ],
    })
    expect(result.data.transactions.map((tx) => tx.id)).toEqual([MAX_ID])
  })

  it('cuts notes to 60 characters', () => {
    const result = inspect({
      transactions: [{ ...validTx, note: 'x'.repeat(5000) }],
      savings: [{ ...validMove, note: 'y'.repeat(5000) }],
      recurring: [{ ...validRecurring, note: 'z'.repeat(5000) }],
    })
    expect(result.data.transactions[0].note).toHaveLength(60)
    expect(result.data.savings[0].note).toHaveLength(60)
    expect(result.data.recurring[0].note).toHaveLength(60)
  })

  it('trims and cuts category names to 24 characters', () => {
    const result = inspect({
      categories: [{ id: 7, name: `  ${'A'.repeat(100)}  `, color: 'cyan' }],
    })
    expect(result.data.categories[0].name).toBe('A'.repeat(24))
  })

  it('merges a category named like a built-in one, in either language', () => {
    const result = inspect({
      categories: [
        { id: 7, name: 'comida', color: 'cyan' },
        { id: 8, name: 'FOOD', color: 'sand' },
        { id: 9, name: 'Mascotas', color: 'slate' },
        { id: 10, name: ' mascotás ', color: 'cyan' },
      ],
      transactions: [
        { ...validTx, id: 1, categoryId: 7 },
        { ...validTx, id: 2, categoryId: 10 },
      ],
    })
    expect(result.data.categories.map((c) => c.id)).toEqual([9])
    // their transactions move to the category that already had the name
    expect(result.data.transactions.map((tx) => tx.categoryId)).toEqual([1, 9])
    expect(result.dropped.categories).toBe(3)
  })

  it('drops years outside 2000-2100', () => {
    const result = inspect({
      transactions: [
        { ...validTx, id: 1, date: '0001-01-01' },
        { ...validTx, id: 2, date: '9999-12-31' },
        { ...validTx, id: 3, date: '2026-10-01' },
      ],
    })
    expect(result.data.transactions.map((tx) => tx.id)).toEqual([3])
  })

  it('rejects text over the size limit', () => {
    expect(inspectBackup('x'.repeat(MAX_BACKUP_BYTES + 1), builtIn)).toEqual({
      ok: false,
      reason: 'tooBig',
    })
  })

  it('rejects a list over the record limit', () => {
    const result = inspect({
      transactions: new Array(MAX_RECORDS + 1).fill(0),
    })
    expect(result).toEqual({ ok: false, reason: 'tooBig' })
  })
})

describe('inspectBackup', () => {
  it('counts what is restored and what is dropped, per list', () => {
    const result = inspectBackup(
      file({
        transactions: [
          validTx,
          { ...validTx, id: 2, amount: -1 },
          { ...validTx, id: 3, date: 'x' },
          validTx,
          'nope',
        ],
        budgets: [validBudget, { categoryId: 99, currency: 'CRC', amount: 5 }],
      }),
      builtIn,
    )
    expect(result.ok).toBe(true)
    expect(result.counts).toEqual({
      categories: 1,
      transactions: 1,
      budgets: 1,
      recurring: 2,
      savings: 2,
      goals: 2,
    })
    expect(result.dropped).toEqual({
      categories: 0,
      transactions: 4,
      budgets: 1,
      recurring: 0,
      savings: 0,
      goals: 0,
    })
    expect(result.droppedTotal).toBe(5)
  })

  it('reports nothing dropped for a clean backup', () => {
    const result = inspectBackup(file(), builtIn)
    expect(result.droppedTotal).toBe(0)
    expect(result.data).toEqual(parseBackup(file(), builtIn))
  })

  it('tells a newer version from a file that is not a backup', () => {
    expect(inspect2({ ...buildBackup(state, now), version: 2 })).toEqual({
      ok: false,
      reason: 'newer',
    })
    expect(inspect2({ ...buildBackup(state, now), version: 'x' }).reason).toBe(
      'format',
    )
    expect(inspect2({ ...buildBackup(state, now), app: 'other' }).reason).toBe(
      'format',
    )
    expect(inspectBackup('not json', builtIn).reason).toBe('format')
    expect(inspectBackup(undefined, builtIn).reason).toBe('format')
    expect(inspectBackup('[]', builtIn).reason).toBe('format')
  })

  it('never throws on hostile structures', () => {
    const hostile = [
      '{"app":"quincena","version":1,"categories":[null,1,"x",[]],"transactions":[null],"budgets":[{}],"recurring":[[]],"savings":[0]}',
      '{"app":"quincena","version":1,"categories":[],"transactions":[{"__proto__":{"x":1},"id":1}],"budgets":[],"recurring":[]}',
    ]
    for (const text of hostile) {
      expect(() => inspectBackup(text, builtIn)).not.toThrow()
      expect(inspectBackup(text, builtIn).ok).toBe(true)
    }
  })
})

function inspect2(object) {
  return inspectBackup(JSON.stringify(object), builtIn)
}

describe('summarizeCounts', () => {
  const t = (key) => `<${key}>`

  it('lists every non-empty list with its count', () => {
    expect(
      summarizeCounts(
        { transactions: 12, budgets: 3, recurring: 0, savings: 4, categories: 1 },
        t,
      ),
    ).toBe(
      '<listTransactions>: 12 · <listBudgets>: 3 · <listSavings>: 4 · <listCategories>: 1',
    )
  })

  it('says there is nothing when every list is empty', () => {
    expect(summarizeCounts({}, t)).toBe('<listNothing>')
    expect(
      summarizeCounts(
        { transactions: 0, budgets: 0, recurring: 0, savings: 0, categories: 0 },
        t,
      ),
    ).toBe('<listNothing>')
  })
})

describe('profile in a backup', () => {
  const profile = { name: 'Ana', currency: 'USD', income: 1200.5, savingsGoal: 100 }

  it('is written and read back, and the format stays version 1', () => {
    const backup = buildBackup({ ...state, profile: { ...profile, onboardedAt: '2026-10-01' } }, now)
    expect(backup.version).toBe(1)
    expect(backup.profile).toEqual(profile)
    expect(parseBackup(JSON.stringify(backup), builtIn).profile).toEqual(profile)
  })

  it('is left out when there is none, and an old backup reads without it', () => {
    expect(buildBackup(state, now)).not.toHaveProperty('profile')
    const result = parseBackup(file(), builtIn)
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('profile')
  })

  it('cleans a damaged one instead of rejecting the backup', () => {
    const dirty = parseBackup(
      file({ profile: { name: '  Ana   M  ', currency: 'EUR', income: -5, savingsGoal: 'x' } }),
      builtIn,
    )
    expect(dirty.profile).toEqual({ name: 'Ana M', currency: 'CRC', income: null, savingsGoal: null })
    for (const bad of [null, 'x', 5, [], undefined]) {
      const result = parseBackup(file({ profile: bad }), builtIn)
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('profile')
    }
  })
})

describe('empty profile in a backup', () => {
  it('is ignored, so a restore does not erase the name and income already there', () => {
    for (const profile of [{}, { name: '  ' }, { currency: 'USD' }, { income: -4 }]) {
      const result = parseBackup(file({ profile }), builtIn)
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('profile')
    }
    expect(parseBackup(file({ profile: { savingsGoal: 5000 } }), builtIn).profile.savingsGoal).toBe(5000)
  })
})

describe('backup reminder snooze', () => {
  const today = new Date(2026, 9, 28)

  it('snoozes until 14 days from today, across month and year ends', () => {
    expect(backupSnoozeUntil(today)).toBe('2026-11-11')
    expect(backupSnoozeUntil(new Date(2026, 11, 25))).toBe('2027-01-08')
  })

  it('is snoozed while the saved date is in the future', () => {
    expect(isBackupReminderSnoozed('2026-11-11', today)).toBe(true)
    expect(isBackupReminderSnoozed('2026-10-29', today)).toBe(true)
  })

  it('is not snoozed on the saved date or after it', () => {
    expect(isBackupReminderSnoozed('2026-10-28', today)).toBe(false)
    expect(isBackupReminderSnoozed('2026-10-01', today)).toBe(false)
  })

  it('reads nothing or garbage as not snoozed', () => {
    expect(isBackupReminderSnoozed(null, today)).toBe(false)
    expect(isBackupReminderSnoozed('', today)).toBe(false)
    expect(isBackupReminderSnoozed('soon', today)).toBe(false)
    expect(isBackupReminderSnoozed('2026-13-40', today)).toBe(false)
  })

  it('a snooze made today ends exactly 14 days later', () => {
    const until = backupSnoozeUntil(today)
    expect(isBackupReminderSnoozed(until, new Date(2026, 10, 10))).toBe(true)
    expect(isBackupReminderSnoozed(until, new Date(2026, 10, 11))).toBe(false)
  })
})

describe('income source and savings goals in a backup', () => {
  // A backup as the app made it before income sources and goals existed
  const oldBackup = JSON.stringify({
    app: 'quincena',
    version: 1,
    exportedAt: '2026-09-01T10:00:00.000Z',
    categories: [{ id: 7, name: 'Mascotas', color: 'cyan' }],
    transactions: [
      { id: 1, amount: 250000, currency: 'CRC', type: 'income', categoryId: null, note: 'Pay', date: '2026-08-01', paymentMethod: 'sinpe' },
      { id: 2, amount: 8500, currency: 'CRC', type: 'expense', categoryId: 1, note: 'Lunch', date: '2026-08-02', paymentMethod: 'cash' },
    ],
    budgets: [],
    recurring: [],
    savings: [{ id: 1, amount: 20000, currency: 'CRC', direction: 'in', note: '', date: '2026-08-03' }],
    quincenaSchedule: DEFAULT_SCHEDULE,
  })

  it('restores an old backup with no source (null) and no goals (empty)', () => {
    const result = inspectBackup(oldBackup, builtIn)
    expect(result.ok).toBe(true)
    expect(result.data.transactions.map((tx) => tx.source)).toEqual([null, null])
    expect(result.data.goals).toEqual([])
    expect(result.counts.goals).toBe(0)
    expect(result.dropped.goals).toBe(0)
    expect(result.data.transactions).toHaveLength(2)
    expect(result.data.savings).toHaveLength(1)
  })

  it('writes goals and sources and reads them back unchanged', () => {
    const backup = buildBackup(state, now)
    expect(backup.goals).toEqual(state.goals)
    expect(backup.transactions[0].source).toBe('salary')
    const result = inspectBackup(JSON.stringify(backup), builtIn)
    expect(result.data.goals).toEqual(state.goals)
    expect(result.data.transactions).toEqual(state.transactions)
    expect(result.counts.goals).toBe(2)
  })

  it('makes a backup without goals when the state has none', () => {
    const { goals, ...noGoals } = state
    expect(goals).toHaveLength(2)
    expect(buildBackup(noGoals, now).goals).toEqual([])
  })

  it('drops an unknown source to null, and any source on an expense', () => {
    const result = parse({
      transactions: [
        { ...validTx, id: 1, type: 'income', categoryId: null, source: 'lottery' },
        { ...validTx, id: 2, type: 'income', categoryId: null, source: 'gift' },
        { ...validTx, id: 3, source: 'salary' },
        { ...validTx, id: 4, type: 'income', categoryId: null, source: 7 },
      ],
    })
    expect(result.transactions.map((tx) => tx.source)).toEqual([null, 'gift', null, null])
  })

  it('cleans goals: cuts the name, drops invalid ones and repeated ids', () => {
    const good = { id: 1, name: 'Trip', target: 100, currency: 'USD', createdAt: '2026-01-01', achievedAt: null }
    const result = parse({
      goals: [
        good,
        { ...good, id: 1, name: 'Repeated id' },
        { ...good, id: 2, name: `  ${'x'.repeat(60)}  ` },
        { ...good, id: 3, name: '   ' },
        { ...good, id: 4, target: 0 },
        { ...good, id: 5, target: 1_000_000_001 },
        { ...good, id: 6, currency: 'EUR' },
        { ...good, id: 7, createdAt: '2026-02-31' },
        { ...good, id: 8, createdAt: undefined },
        { ...good, id: 0 },
        { ...good, id: 9, achievedAt: 'yesterday' },
        { ...good, id: 10, achievedAt: '2026-05-05' },
        'nope',
        null,
      ],
    })
    expect(result.goals.map((g) => g.id)).toEqual([1, 2, 9, 10])
    expect(result.goals[0].name).toBe('Trip')
    expect(result.goals[1].name).toBe('x'.repeat(40))
    expect(result.goals[2].achievedAt).toBeNull()
    expect(result.goals[3].achievedAt).toBe('2026-05-05')
  })

  it('counts dropped goals, and refuses a goals field that is not a list', () => {
    const inspected = inspectBackup(file({ goals: [state.goals[0], 'bad'] }), builtIn)
    expect(inspected.counts.goals).toBe(1)
    expect(inspected.dropped.goals).toBe(1)
    expect(parse({ goals: 'x' })).toBeNull()
    expect(parse({ goals: {} })).toBeNull()
  })

  it('refuses too many goals', () => {
    const many = { goals: new Array(MAX_RECORDS + 1).fill(0) }
    expect(inspectBackup(file(many), builtIn)).toEqual({ ok: false, reason: 'tooBig' })
  })

  it('names the goals in the summary', () => {
    const t = (key) => `<${key}>`
    expect(summarizeCounts({ goals: 2 }, t)).toBe('<listGoals>: 2')
  })
})
