import { describe, expect, it } from 'vitest'
import { buildReport } from './report'
import { getTotals } from './money'

const t = (key) => key
const categories = [
  { id: 1, key: 'food', color: 'amber' },
  { id: 2, key: 'transport', color: 'blue' },
  { id: 3, name: 'Mine', color: 'slate' },
]

let nextId = 1
const tx = (date, type, amount, currency, categoryId, extra = {}) => ({
  id: nextId++,
  date,
  type,
  amount,
  currency,
  categoryId,
  note: '',
  paymentMethod: 'cash',
  ...extra,
})

const transactions = [
  tx('2026-10-20', 'expense', 3000, 'CRC', 1, { note: 'Lunch' }),
  tx('2026-10-20', 'expense', 1000, 'CRC', 2),
  tx('2026-10-05', 'income', 500000, 'CRC', 1),
  tx('2026-10-05', 'expense', 12.5, 'USD', 3),
  tx('2026-09-30', 'expense', 7000, 'CRC', 1),
  tx('2026-08-01', 'income', 20, 'USD', 1),
]
const savings = [
  { id: 1, date: '2026-10-06', direction: 'in', amount: 10000, currency: 'CRC', note: '' },
  { id: 2, date: '2026-10-07', direction: 'out', amount: 2000, currency: 'CRC', note: '' },
  { id: 3, date: '2026-09-01', direction: 'in', amount: 5, currency: 'USD', note: '' },
]
const base = { transactions, savings, categories, t }

describe('buildReport', () => {
  it('gives no sections for empty input', () => {
    expect(buildReport({ ...base, transactions: [], savings: [] }).sections).toEqual([])
    expect(
      buildReport({ ...base, transactions: [], savings: [], scope: { kind: 'month', year: 2026, month: 9 } })
        .sections,
    ).toEqual([])
  })

  it('makes one section per month, newest first', () => {
    const { sections } = buildReport({ ...base, scope: { kind: 'all' } })
    expect(sections.map((s) => s.key)).toEqual(['2026-10', '2026-09', '2026-08'])
    expect(sections[0]).toMatchObject({ year: 2026, month: 9 })
  })

  it('totals per currency match getTotals and savings moves', () => {
    const { sections } = buildReport(base)
    const october = sections[0]
    const month = transactions.filter((x) => x.date.startsWith('2026-10'))
    for (const row of october.totals) {
      const expected = getTotals(month, row.code)
      expect(row.income).toBe(expected.income)
      expect(row.spent).toBe(expected.spent)
    }
    expect(october.totals).toEqual([
      { code: 'CRC', income: 500000, spent: 4000, savedIn: 10000, savedOut: 2000 },
      { code: 'USD', income: 0, spent: 12.5, savedIn: 0, savedOut: 0 },
    ])
  })

  it('only lists currencies that have data and never mixes them', () => {
    const { sections } = buildReport(base)
    expect(sections[1].totals.map((r) => r.code)).toEqual(['CRC', 'USD']) // savings in USD
    expect(sections[1].totals[1]).toEqual({ code: 'USD', income: 0, spent: 0, savedIn: 5, savedOut: 0 })
    expect(sections[2].totals.map((r) => r.code)).toEqual(['USD'])
  })

  it('only includes the month asked for', () => {
    const { sections } = buildReport({ ...base, scope: { kind: 'month', year: 2026, month: 9 } })
    expect(sections).toHaveLength(1)
    const dates = sections[0].days.flatMap((d) => d.items.map((i) => i.date))
    expect(dates.every((d) => d.startsWith('2026-10'))).toBe(true)
    expect(sections[0].totals[0].savedIn).toBe(10000)
  })

  it('makes one section for a list, with no savings', () => {
    const ids = [transactions[0].id, transactions[4].id]
    const { sections } = buildReport({ ...base, scope: { kind: 'list', ids } })
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ key: 'list', year: null, month: null })
    expect(sections[0].days.flatMap((d) => d.items.map((i) => i.id))).toEqual(ids)
    expect(sections[0].totals).toEqual([
      { code: 'CRC', income: 0, spent: 10000, savedIn: 0, savedOut: 0 },
    ])
  })

  it('splits spending by category per currency with shares of that currency', () => {
    const [october] = buildReport(base).sections
    const crc = october.categories.find((c) => c.code === 'CRC')
    expect(crc.rows.map((r) => [r.label, r.amount, r.share])).toEqual([
      ['category.food', 3000, 75],
      ['category.transport', 1000, 25],
    ])
    const usd = october.categories.find((c) => c.code === 'USD')
    expect(usd.rows).toHaveLength(1)
    expect(usd.rows[0]).toMatchObject({ label: 'Mine', amount: 12.5, share: 100 })
  })

  it('groups movements by day, newest first, with signed amounts', () => {
    const [october] = buildReport(base).sections
    expect(october.days.map((d) => d.date)).toEqual(['2026-10-20', '2026-10-05'])
    const [transport, lunch] = october.days[0].items
    // same day: the one added last comes first
    expect(transport.description).toBe('category.transport')
    expect(lunch).toMatchObject({
      description: 'Lunch',
      categoryLabel: 'category.food',
      paymentLabel: 'payCash',
      amount: -3000,
      currency: 'CRC',
    })
    expect(october.days[1].items.find((i) => i.type === 'income').amount).toBe(500000)
  })

  it('names an income without a category after its type', () => {
    const { sections } = buildReport({
      ...base,
      transactions: [tx('2026-10-01', 'income', 100, 'CRC', null)],
      savings: [],
    })
    expect(sections[0].days[0].items[0].categoryLabel).toBe('typeIncome')
  })

  it('files an expense with a missing category under uncategorized', () => {
    const { sections } = buildReport({
      ...base,
      transactions: [tx('2026-10-01', 'expense', 100, 'CRC', 99)],
      savings: [],
    })
    expect(sections[0].days[0].items[0].categoryLabel).toBe('category.uncategorized')
  })
})
