import { describe, expect, it } from 'vitest'
import { MAX_PROFILE_NAME_LENGTH } from './limits'
import {
  buildFixedExpense,
  buildIncomeItem,
  cleanCurrency,
  cleanName,
  freePerQuincena,
  isOnboarded,
  planIncome,
  optionalAmount,
  quincenasPerMonth,
  scheduleForOnboarding,
  overspendCause,
} from './onboarding'
import { DEFAULT_SCHEDULE } from './quincenaSchedule'

describe('cleanName', () => {
  it('trims, collapses spaces and cuts to the limit', () => {
    expect(cleanName('  Ana   María ')).toBe('Ana María')
    expect(cleanName('x'.repeat(100))).toHaveLength(MAX_PROFILE_NAME_LENGTH)
    expect(cleanName('')).toBe('')
    expect(cleanName(undefined)).toBe('')
    expect(cleanName(42)).toBe('')
  })
})

describe('cleanCurrency and isOnboarded', () => {
  it('only knows colones and dollars', () => {
    expect(cleanCurrency('USD')).toBe('USD')
    expect(cleanCurrency('CRC')).toBe('CRC')
    expect(cleanCurrency('EUR')).toBe('CRC')
    expect(cleanCurrency(undefined)).toBe('CRC')
  })

  it('is done only with a date', () => {
    expect(isOnboarded({ onboardedAt: '2026-10-13' })).toBe(true)
    expect(isOnboarded({ onboardedAt: null })).toBe(false)
    expect(isOnboarded({ onboardedAt: '' })).toBe(false)
    expect(isOnboarded(null)).toBe(false)
    expect(isOnboarded(undefined)).toBe(false)
  })
})

describe('optionalAmount', () => {
  it('reads empty as nothing, a valid amount as a number, the rest as invalid', () => {
    expect(optionalAmount('')).toBeNull()
    expect(optionalAmount('  ')).toBeNull()
    expect(optionalAmount('0')).toBeNull()
    expect(optionalAmount('450.000')).toBe(450000)
    expect(optionalAmount('12,50')).toBe(12.5)
    expect(optionalAmount('abc')).toBeUndefined()
    expect(optionalAmount('-5')).toBeUndefined()
    expect(optionalAmount('9999999999')).toBeUndefined()
  })
})

describe('quincenasPerMonth', () => {
  it('is 2 for 15/30 and two pay days, 1 for a single pay day', () => {
    expect(quincenasPerMonth({ mode: 'fixed' })).toBe(2)
    expect(quincenasPerMonth({ mode: 'paydays', day1: 5, day2: 20 })).toBe(2)
    expect(quincenasPerMonth({ mode: 'paydays', day1: 30, day2: null })).toBe(1)
    expect(quincenasPerMonth({ mode: 'paydays', day1: 5, day2: 5 })).toBe(1)
    expect(quincenasPerMonth(undefined)).toBe(2)
  })
})

describe('freePerQuincena', () => {
  it('takes the fixed expenses and the goal out of one pay', () => {
    const result = freePerQuincena({
      income: 500000,
      expenses: [
        { amount: 20000, schedule: 'every' },
        { amount: 200000, schedule: 'first' },
        { amount: 30000, schedule: 'second' },
      ],
      savingsGoal: 25000,
      perMonth: 2,
    })
    // 20.000 + (200.000 + 30.000) / 2 = 135.000
    expect(result).toEqual({
      income: 500000,
      fixed: 135000,
      goal: 25000,
      free: 340000,
    })
  })

  it('counts a monthly expense in full when there is one pay day a month', () => {
    const result = freePerQuincena({
      income: 900000,
      expenses: [
        { amount: 300000, schedule: 'first' },
        { amount: 10000, schedule: 'every' },
      ],
      perMonth: 1,
    })
    expect(result.fixed).toBe(310000)
    expect(result.free).toBe(590000)
  })

  it('can be negative and works with nothing at all', () => {
    expect(
      freePerQuincena({ income: 1000, expenses: [{ amount: 5000, schedule: 'every' }] })
        .free,
    ).toBe(-4000)
    expect(freePerQuincena({})).toEqual({ income: 0, fixed: 0, goal: 0, free: 0 })
  })

  it('keeps cents exact (dollars)', () => {
    const result = freePerQuincena({
      income: 100.1,
      expenses: [
        { amount: 0.2, schedule: 'every' },
        { amount: 10.05, schedule: 'first' },
      ],
      perMonth: 2,
    })
    expect(result.fixed).toBe(5.23)
    expect(result.free).toBe(94.87)
  })
})

describe('scheduleForOnboarding', () => {
  const today = new Date(2026, 9, 13)

  it('puts the choice in force from the start when nothing is registered', () => {
    expect(
      scheduleForOnboarding(
        DEFAULT_SCHEDULE,
        { mode: 'paydays', day1: 20, day2: 5 },
        today,
        false,
      ),
    ).toEqual([{ from: '2000-01-01', mode: 'paydays', day1: 5, day2: 20 }])
    expect(
      scheduleForOnboarding(DEFAULT_SCHEDULE, { mode: 'fixed' }, today, false),
    ).toEqual(DEFAULT_SCHEDULE)
  })

  it('defers the change when there is data, never moving the past', () => {
    const result = scheduleForOnboarding(
      DEFAULT_SCHEDULE,
      { mode: 'paydays', day1: 5, day2: 20 },
      today,
      true,
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(DEFAULT_SCHEDULE[0])
    expect(result[1].from > '2026-10-13').toBe(true)
  })
})

describe('buildFixedExpense', () => {
  it('builds a recurring expense item', () => {
    expect(
      buildFixedExpense({
        name: '  Alquiler ',
        amountText: '250.000',
        schedule: 'first',
        currency: 'CRC',
      }),
    ).toEqual({
      ok: true,
      item: {
        amount: 250000,
        currency: 'CRC',
        type: 'expense',
        categoryId: 3,
        note: 'Alquiler',
        schedule: 'first',
      },
    })
  })

  it('rejects an empty name and a missing or invalid amount', () => {
    expect(buildFixedExpense({ name: ' ', amountText: '100' })).toEqual({
      ok: false,
      reason: 'name',
    })
    expect(buildFixedExpense({ name: 'Luz', amountText: '' })).toEqual({
      ok: false,
      reason: 'amount',
    })
    expect(buildFixedExpense({ name: 'Luz', amountText: '0' })).toEqual({
      ok: false,
      reason: 'amount',
    })
    expect(buildFixedExpense({ name: 'Luz', amountText: 'mucho' })).toEqual({
      ok: false,
      reason: 'amount',
    })
  })

  it('cuts a long name to the note limit and fixes a bad currency', () => {
    const result = buildFixedExpense({
      name: 'n'.repeat(90),
      amountText: '5',
      currency: 'EUR',
    })
    expect(result.item.note).toHaveLength(60)
    expect(result.item.currency).toBe('CRC')
  })
})

describe('buildIncomeItem', () => {
  it('is an income that repeats every quincena', () => {
    expect(buildIncomeItem(450000, 'USD', 'Salario')).toEqual({
      amount: 450000,
      currency: 'USD',
      type: 'income',
      categoryId: null,
      note: 'Salario',
      schedule: 'every',
    })
  })
})

describe('planIncome', () => {
  const income = (changes = {}) => ({
    id: 5,
    type: 'income',
    schedule: 'every',
    amount: 450000,
    currency: 'CRC',
    note: 'Salario',
    lastPeriod: '2026-10-1',
    categoryId: null,
    ...changes,
  })

  it('does nothing when no income was typed', () => {
    expect(
      planIncome({ income: null, currency: 'CRC', note: 'x', recurring: [income()] }),
    ).toEqual({ action: 'none' })
  })

  it('adds the income the first time', () => {
    expect(
      planIncome({ income: 300000, currency: 'CRC', note: 'Salario', recurring: [] }),
    ).toEqual({
      action: 'add',
      item: buildIncomeItem(300000, 'CRC', 'Salario'),
    })
  })

  it('changes the income the welcome created instead of adding another', () => {
    const result = planIncome({
      income: 500000,
      currency: 'CRC',
      note: 'Income',
      previous: { income: 450000, currency: 'CRC' },
      recurring: [income()],
    })
    expect(result.action).toBe('update')
    expect(result.id).toBe(5)
    expect(result.item).toMatchObject({
      amount: 500000,
      note: 'Salario',
      lastPeriod: '2026-10-1',
    })
  })

  it('does nothing when the income did not change, or already exists', () => {
    const same = {
      income: 450000,
      currency: 'CRC',
      note: 'x',
      previous: { income: 450000, currency: 'CRC' },
      recurring: [income()],
    }
    expect(planIncome(same)).toEqual({ action: 'none' })
    expect(planIncome({ ...same, previous: null })).toEqual({ action: 'none' })
  })

  it('adds when the old income was deleted in the meantime', () => {
    const result = planIncome({
      income: 450000,
      currency: 'CRC',
      note: 'Salario',
      previous: { income: 450000, currency: 'CRC' },
      recurring: [],
    })
    expect(result.action).toBe('add')
  })
})

describe('guards found in review', () => {
  it('freePerQuincena reads a bad pay-day count as one a month', () => {
    const expenses = [{ amount: 100, schedule: 'first' }]
    for (const perMonth of [0, -2, undefined, NaN]) {
      const result = freePerQuincena({ income: 1000, expenses, perMonth })
      expect(Number.isFinite(result.free)).toBe(true)
    }
  })

  it('planIncome does nothing for an income of 0 or less', () => {
    expect(planIncome({ income: 0, currency: 'CRC', note: 'x', recurring: [] })).toEqual({ action: 'none' })
    expect(planIncome({ income: -5, currency: 'CRC', note: 'x', recurring: [] })).toEqual({ action: 'none' })
  })

  it('planIncome adds a new income when the currency changed (no conversion)', () => {
    const old = { id: 1, type: 'income', schedule: 'every', amount: 450000, currency: 'CRC', note: 'S', lastPeriod: null }
    const result = planIncome({
      income: 900,
      currency: 'USD',
      note: 'Salary',
      previous: { income: 450000, currency: 'CRC' },
      recurring: [old],
    })
    expect(result.action).toBe('update')
    expect(result.item.currency).toBe('USD')
  })
})

describe('buildFixedExpense with a new category', () => {
  const base = { name: 'Pasajes', amountText: '10.000', schedule: 'every' }

  it('carries the new category name instead of an id', () => {
    expect(
      buildFixedExpense({ ...base, categoryId: 'new', newCategoryName: '  Pasajes   bus ' }),
    ).toEqual({
      ok: true,
      item: {
        amount: 10000,
        currency: 'CRC',
        type: 'expense',
        note: 'Pasajes',
        schedule: 'every',
        categoryId: null,
        newCategory: 'Pasajes bus',
      },
    })
  })

  it('needs a name for it, and cuts it to the category limit', () => {
    expect(buildFixedExpense({ ...base, categoryId: 'new', newCategoryName: '  ' })).toEqual({
      ok: false,
      reason: 'category',
    })
    const long = buildFixedExpense({ ...base, categoryId: 'new', newCategoryName: 'x'.repeat(50) })
    expect(long.item.newCategory).toHaveLength(24)
  })

  it('keeps an existing category id as it is', () => {
    expect(buildFixedExpense({ ...base, categoryId: 2 }).item.categoryId).toBe(2)
  })
})

describe('scheduleForOnboarding with manual pay days', () => {
  const today = new Date(2026, 9, 13)
  const choice = { mode: 'manual', from: '2026-10-11' }

  it('keeps 15/30 before the paid day when there is no data', () => {
    expect(scheduleForOnboarding(DEFAULT_SCHEDULE, choice, today, false)).toEqual([
      DEFAULT_SCHEDULE[0],
      { from: '2026-10-11', mode: 'manual', day1: 1, day2: null },
    ])
    // even a paid day before the quincena in progress: nothing to protect
    expect(
      scheduleForOnboarding(DEFAULT_SCHEDULE, { mode: 'manual', from: '2026-09-28' }, today, false)[1].from,
    ).toBe('2026-09-28')
  })

  it('with data goes through registerPayday and never moves the past', () => {
    const ok = scheduleForOnboarding(DEFAULT_SCHEDULE, choice, today, true)
    expect(ok.map((e) => e.mode)).toEqual(['fixed', 'manual'])
    const early = scheduleForOnboarding(
      DEFAULT_SCHEDULE,
      { mode: 'manual', from: '2026-09-28' },
      today,
      true,
    )
    expect(early).toEqual(DEFAULT_SCHEDULE)
  })

  it('counts two quincenas a month for manual pay days', () => {
    expect(quincenasPerMonth({ mode: 'manual', from: '2026-10-11' })).toBe(2)
  })
})

describe('overspendCause', () => {
  it('is null when something is left free', () => {
    expect(overspendCause(freePerQuincena({ income: 350000, expenses: [], savingsGoal: 25000 }))).toBe(null)
    expect(overspendCause(freePerQuincena({ income: 100, expenses: [{ amount: 100, schedule: 'every' }] }))).toBe(null)
  })

  it('blames the fixed expenses when they alone are more than the pay', () => {
    const figures = freePerQuincena({ income: 100000, expenses: [{ amount: 150000, schedule: 'every' }] })
    expect(overspendCause(figures)).toBe('fixed')
  })

  it('blames the savings goal when the fixed expenses fit but the goal tips it over', () => {
    // seen on the live site: ₡350.000 pay, ₡150.000 monthly rent, ₡300.000 goal
    const figures = freePerQuincena({
      income: 350000,
      expenses: [{ amount: 150000, schedule: 'first' }],
      savingsGoal: 300000,
    })
    expect(figures.free).toBe(-25000)
    expect(overspendCause(figures)).toBe('goal')
  })
})
