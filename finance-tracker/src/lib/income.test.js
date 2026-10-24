import { describe, expect, it } from 'vitest'
import {
  INCOME_SOURCES,
  incomeSummary,
  normalizeSource,
  periodRange,
  sourceFor,
  sourceLabelKey,
} from './income'
import { translations } from './translations'

describe('normalizeSource', () => {
  it('keeps the four known sources', () => {
    expect(INCOME_SOURCES).toEqual(['salary', 'freelance', 'gift', 'other'])
    for (const source of INCOME_SOURCES) expect(normalizeSource(source)).toBe(source)
  })

  it('reads anything else as none', () => {
    for (const bad of [undefined, null, '', 'Salary', 'lottery', 5, {}, []]) {
      expect(normalizeSource(bad)).toBeNull()
    }
  })
})

describe('sourceFor', () => {
  it('only an income has a source', () => {
    expect(sourceFor({ type: 'income', source: 'gift' })).toBe('gift')
    expect(sourceFor({ type: 'income' })).toBeNull()
    expect(sourceFor({ type: 'expense', source: 'gift' })).toBeNull()
    expect(sourceFor(undefined)).toBeNull()
  })
})

describe('incomeSummary', () => {
  const income = (changes) => ({
    type: 'income',
    currency: 'CRC',
    amount: 100,
    date: '2026-10-05',
    source: 'salary',
    ...changes,
  })

  it('totals by currency and by source, without mixing currencies', () => {
    const result = incomeSummary(
      [
        income({ amount: 250000 }),
        income({ amount: 40000.5, source: 'freelance' }),
        income({ amount: 15, currency: 'USD', source: 'gift' }),
        income({ amount: 20, currency: 'USD', source: null }),
      ],
      { from: '2026-10-01', to: '2026-10-31' },
    )
    expect(result.CRC.total).toBe(290000.5)
    expect(result.CRC.totalCents).toBe(29000050)
    expect(result.CRC.count).toBe(2)
    expect(result.CRC.bySource).toEqual({
      none: 0,
      salary: 250000,
      freelance: 40000.5,
      gift: 0,
      other: 0,
    })
    expect(result.USD.total).toBe(35)
    expect(result.USD.count).toBe(2)
    expect(result.USD.bySource.gift).toBe(15)
    expect(result.USD.bySource.none).toBe(20)
  })

  it('ignores expenses', () => {
    const result = incomeSummary([{ ...income(), type: 'expense', amount: 999 }], {})
    expect(result.CRC.total).toBe(0)
    expect(result.CRC.count).toBe(0)
  })

  it('includes both ends of the period and leaves the rest out', () => {
    const result = incomeSummary(
      [
        income({ date: '2026-09-30', amount: 1 }),
        income({ date: '2026-10-01', amount: 10 }),
        income({ date: '2026-10-31', amount: 100 }),
        income({ date: '2026-11-01', amount: 1000 }),
      ],
      { from: '2026-10-01', to: '2026-10-31' },
    )
    expect(result.CRC.total).toBe(110)
    expect(result.CRC.count).toBe(2)
  })

  it('has no limits when the period is open', () => {
    const list = [income({ date: '2020-01-01' }), income({ date: '2030-01-01' })]
    expect(incomeSummary(list).CRC.count).toBe(2)
    expect(incomeSummary(list, { from: '2025-01-01' }).CRC.count).toBe(1)
    expect(incomeSummary(list, { to: '2025-01-01' }).CRC.count).toBe(1)
  })

  it('adds in whole cents (no floating point noise)', () => {
    const list = Array.from({ length: 10 }, () => income({ amount: 0.1 }))
    expect(incomeSummary(list).CRC.total).toBe(1)
    expect(incomeSummary(list).CRC.totalCents).toBe(100)
  })

  it('reads an unknown source as none', () => {
    const result = incomeSummary([income({ source: 'lottery', amount: 7 })])
    expect(result.CRC.bySource.none).toBe(7)
  })

  it('always has both currencies', () => {
    const result = incomeSummary([])
    expect(Object.keys(result)).toEqual(['CRC', 'USD'])
    expect(result.USD).toEqual({
      total: 0,
      totalCents: 0,
      count: 0,
      bySource: { none: 0, salary: 0, freelance: 0, gift: 0, other: 0 },
    })
  })
})

describe('periodRange', () => {
  it('is the calendar month of today', () => {
    expect(periodRange('month', new Date(2026, 9, 24))).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
    expect(periodRange('month', new Date(2028, 1, 10))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
    expect(periodRange('month', new Date(2026, 1, 10))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
  })

  it('is the calendar year of today', () => {
    expect(periodRange('year', new Date(2026, 9, 24))).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })

  it('takes a custom period, swapping it if it is backwards', () => {
    expect(periodRange({ from: '2026-03-01', to: '2026-03-15' })).toEqual({
      from: '2026-03-01',
      to: '2026-03-15',
    })
    expect(periodRange({ from: '2026-03-15', to: '2026-03-01' })).toEqual({
      from: '2026-03-01',
      to: '2026-03-15',
    })
  })

  it('is null for an invalid custom period or kind', () => {
    expect(periodRange({ from: '2026-02-31', to: '2026-03-01' })).toBeNull()
    expect(periodRange({ from: '2026-03-01' })).toBeNull()
    expect(periodRange('week')).toBeNull()
    expect(periodRange(undefined)).toBeNull()
  })
})

describe('sourceLabelKey', () => {
  it('names each source and falls back to "no source"', () => {
    const labelKey = sourceLabelKey
    for (const source of ['salary', 'freelance', 'gift', 'other']) {
      const key = labelKey(source)
      expect(translations.es[key]).toBeTruthy()
      expect(translations.en[key]).toBeTruthy()
    }
    expect(labelKey(null)).toBe('sourceNone')
    expect(labelKey('lottery')).toBe('sourceNone')
  })
})
