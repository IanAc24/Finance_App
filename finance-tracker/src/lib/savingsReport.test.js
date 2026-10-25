import { describe, expect, it } from 'vitest'
import { getTotals } from './money'
import { savingsBalance } from './savings'
import {
  availableYears,
  periodSurplus,
  savingsYear,
  yearFromParam,
  yearRecap,
} from './savingsReport'

const move = (date, amount, direction = 'in', currency = 'CRC', id = 1) => ({
  id,
  amount,
  currency,
  direction,
  note: '',
  date,
})
const tx = (date, amount, type = 'expense', currency = 'CRC') => ({
  id: 1,
  amount,
  currency,
  type,
  categoryId: null,
  note: '',
  date,
})

describe('savingsYear', () => {
  it('opens with everything before Jan 1 and closes with opening + in - out', () => {
    const savings = [
      move('2024-06-01', 1000),
      move('2025-03-01', 500),
      move('2025-04-01', 200, 'out'),
      move('2025-12-31', 300),
      move('2026-01-01', 50),
    ]
    expect(savingsYear(savings, 2025, 'CRC')).toEqual({
      opening: 1000,
      deposits: 800,
      withdrawals: 200,
      closing: 1600,
    })
  })

  it('puts Dec 31 in the old year and Jan 1 in the new one', () => {
    const savings = [move('2025-12-31', 100), move('2026-01-01', 10)]
    expect(savingsYear(savings, 2025, 'CRC')).toMatchObject({ opening: 0, deposits: 100, closing: 100 })
    expect(savingsYear(savings, 2026, 'CRC')).toMatchObject({
      opening: 100,
      deposits: 10,
      closing: 110,
    })
  })

  it('never resets: the closing of a year is the opening of the next', () => {
    const savings = [
      move('2023-05-01', 700),
      move('2024-05-01', 100, 'out'),
      move('2025-05-01', 40),
    ]
    const closing = (year) => savingsYear(savings, year, 'CRC').closing
    expect(savingsYear(savings, 2024, 'CRC').opening).toBe(closing(2023))
    expect(savingsYear(savings, 2025, 'CRC').opening).toBe(closing(2024))
    expect(closing(2025)).toBe(640)
    // a year with no moves still carries the balance
    expect(savingsYear(savings, 2030, 'CRC')).toEqual({
      opening: 640,
      deposits: 0,
      withdrawals: 0,
      closing: 640,
    })
  })

  it('ignores moves of later years', () => {
    expect(savingsYear([move('2027-01-01', 5)], 2026, 'CRC').closing).toBe(0)
  })

  it('keeps currencies apart', () => {
    const savings = [
      move('2026-02-01', 1000, 'in', 'CRC'),
      move('2026-02-02', 20, 'in', 'USD'),
      move('2025-02-02', 5, 'in', 'USD'),
    ]
    expect(savingsYear(savings, 2026, 'CRC')).toMatchObject({ opening: 0, deposits: 1000 })
    expect(savingsYear(savings, 2026, 'USD')).toMatchObject({ opening: 5, deposits: 20, closing: 25 })
  })

  it('adds in whole cents', () => {
    const savings = Array.from({ length: 10 }, (_, i) => move('2026-03-01', 0.1, 'in', 'CRC', i + 1))
    expect(savingsYear(savings, 2026, 'CRC').deposits).toBe(1)
    expect(savingsYear(savings, 2027, 'CRC').opening).toBe(1)
  })

  it('agrees with the plain balance at the end of the last year', () => {
    const savings = [move('2025-01-01', 90.1), move('2026-06-01', 10.2, 'out')]
    expect(savingsYear(savings, 2026, 'CRC').closing).toBe(savingsBalance(savings, 'CRC'))
  })
})

describe('yearFromParam', () => {
  it('reads a four digit year between 2000 and 2100', () => {
    expect(yearFromParam('2026')).toBe(2026)
    expect(yearFromParam('2000')).toBe(2000)
    expect(yearFromParam('2100')).toBe(2100)
  })

  it('answers null for anything else, so the screen goes back', () => {
    for (const bad of ['1999', '2101', '0001', '9999', '26', 'abcd', '2026.5', '', undefined]) {
      expect(yearFromParam(bad)).toBeNull()
    }
  })
})

describe('periodSurplus', () => {
  it('is income minus expenses of one currency, both ends included', () => {
    const list = [
      tx('2026-10-01', 1000, 'income'),
      tx('2026-10-31', 300),
      tx('2026-09-30', 999, 'income'),
      tx('2026-11-01', 999),
      tx('2026-10-15', 50, 'income', 'USD'),
    ]
    expect(periodSurplus(list, '2026-10-01', '2026-10-31', 'CRC')).toBe(700)
    expect(periodSurplus(list, '2026-10-01', '2026-10-31', 'USD')).toBe(50)
  })

  it('can be negative and ignores savings moves entirely', () => {
    expect(periodSurplus([tx('2026-10-01', 20)], '2026-10-01', '2026-10-01', 'CRC')).toBe(-20)
  })
})

describe('availableYears', () => {
  it('lists the years with data, newest first, without repeats', () => {
    expect(
      availableYears(
        [tx('2024-05-01', 1), tx('2026-01-01', 1), tx('2026-02-01', 1)],
        [move('2025-12-31', 1)],
        [{ achievedAt: '2027-03-03' }, { achievedAt: null }],
      ),
    ).toEqual([2027, 2026, 2025, 2024])
  })

  it('is empty without data', () => {
    expect(availableYears([], [], [])).toEqual([])
    expect(availableYears([], [])).toEqual([])
  })
})

describe('yearRecap', () => {
  const goals = [
    { id: 1, name: 'Trip', target: 500, currency: 'CRC', createdAt: '2025-01-01', achievedAt: '2026-03-01' },
    { id: 2, name: 'Old', target: 500, currency: 'CRC', createdAt: '2024-01-01', achievedAt: '2025-12-31' },
    { id: 3, name: 'Laptop', target: 90, currency: 'USD', createdAt: '2025-01-01', achievedAt: '2026-04-01' },
    { id: 4, name: 'Open', target: 90, currency: 'USD', createdAt: '2025-01-01', achievedAt: null },
  ]
  const transactions = [
    tx('2025-01-10', 2000, 'income'),
    tx('2025-02-10', 500),
    tx('2026-01-01', 3000, 'income'),
    tx('2026-12-31', 1200),
    tx('2026-05-05', 100, 'income', 'USD'),
    tx('2026-06-05', 30, 'expense', 'USD'),
  ]
  const savings = [
    move('2025-03-01', 400, 'in', 'CRC', 1),
    move('2026-01-02', 100, 'out', 'CRC', 2),
    move('2026-12-31', 250, 'in', 'CRC', 3),
    move('2026-07-01', 40, 'in', 'USD', 4),
  ]

  it('gives income, expenses, surplus and savings per currency', () => {
    const recap = yearRecap(transactions, savings, goals, 2026)
    expect(recap.CRC).toMatchObject({
      income: 3000,
      expenses: 1200,
      surplus: 1800,
      deposits: 250,
      withdrawals: 100,
      opening: 400,
      closing: 550,
      incomplete: false,
      reason: null,
    })
    expect(recap.USD).toMatchObject({
      income: 100,
      expenses: 30,
      surplus: 70,
      deposits: 40,
      withdrawals: 0,
      opening: 0,
      closing: 40,
      incomplete: false,
    })
  })

  it('lists the goals reached in the year, by currency', () => {
    const recap = yearRecap(transactions, savings, goals, 2026)
    expect(recap.CRC.goalsAchieved.map((g) => g.id)).toEqual([1])
    expect(recap.USD.goalsAchieved.map((g) => g.id)).toEqual([3])
    expect(yearRecap(transactions, savings, goals, 2025).CRC.goalsAchieved.map((g) => g.id)).toEqual([2])
  })

  it('never presents the surplus as savings', () => {
    const recap = yearRecap(transactions, savings, goals, 2026).CRC
    expect(recap.surplus).not.toBe(recap.deposits)
    expect(recap.closing).not.toBe(recap.opening + recap.surplus)
  })

  it('does not treat savings moves as income or expenses', () => {
    const without = yearRecap(transactions, [], goals, 2026).CRC
    const withMoves = yearRecap(transactions, savings, goals, 2026).CRC
    expect(withMoves.income).toBe(without.income)
    expect(withMoves.expenses).toBe(without.expenses)
    expect(withMoves.surplus).toBe(without.surplus)
    // the totals helpers used all over the app only read transactions
    expect(getTotals(transactions, 'CRC')).toMatchObject({ income: 5000, spent: 1700 })
  })

  it('splits the year at Jan 1: Dec 31 belongs to the old year', () => {
    const list = [tx('2025-12-31', 10), tx('2026-01-01', 20)]
    expect(yearRecap(list, [], [], 2025).CRC.expenses).toBe(10)
    expect(yearRecap(list, [], [], 2026).CRC.expenses).toBe(20)
  })

  it('a year without activity but with a carried balance shows opening = closing, not no data', () => {
    const recap = yearRecap(transactions, savings, goals, 2028)
    expect(recap.CRC.reason).not.toBe('noData')
    expect(recap.CRC).toMatchObject({ income: 0, surplus: 0, deposits: 0, withdrawals: 0 })
    expect(recap.CRC.opening).toBe(550)
    expect(recap.CRC.closing).toBe(550)
  })

  it('flags a currency with no moves, no transactions and no balance as no data', () => {
    const recap = yearRecap([tx('2025-05-01', 10)], [], [], 2027)
    expect(recap.USD).toMatchObject({ incomplete: true, reason: 'noData', opening: 0, closing: 0 })
    expect(recap.CRC).toMatchObject({ incomplete: true, reason: 'noData' })
    expect(yearRecap([], [], [], 2026).CRC).toMatchObject({ incomplete: true, reason: 'noData' })
  })

  it('keeps every figure that exists when the savings start before the history', () => {
    const list = [tx('2026-03-01', 800, 'income'), tx('2026-04-01', 120)]
    const recap = yearRecap(list, [move('2025-11-01', 500)], [], 2026).CRC
    expect(recap.reason).toBe('historyAfterSavings')
    expect(recap).toMatchObject({ income: 800, expenses: 120, surplus: 680, opening: 500, closing: 500 })
  })

  it('flags savings moves before the first transaction as incomplete', () => {
    const late = [tx('2026-03-01', 100, 'income'), tx('2026-04-01', 40)]
    const early = [move('2025-11-01', 500)]
    const recap = yearRecap(late, early, [], 2026).CRC
    expect(recap.incomplete).toBe(true)
    expect(recap.reason).toBe('historyAfterSavings')
    expect(recap.opening).toBe(500)
    // a move on the same day as the first transaction is fine
    expect(yearRecap(late, [move('2026-03-01', 5)], [], 2026).CRC.incomplete).toBe(false)
    // the other currency is judged on its own
    expect(yearRecap(late, [move('2025-11-01', 5, 'in', 'USD')], [], 2026).CRC.incomplete).toBe(false)
  })

  it('flags savings with no transactions at all', () => {
    const recap = yearRecap([], [move('2026-03-01', 500)], [], 2026).CRC
    expect(recap.incomplete).toBe(true)
    expect(recap.reason).toBe('historyAfterSavings')
  })

  it('works across several years without leaking between them', () => {
    const recap2025 = yearRecap(transactions, savings, goals, 2025).CRC
    expect(recap2025).toMatchObject({
      income: 2000,
      expenses: 500,
      surplus: 1500,
      deposits: 400,
      opening: 0,
      closing: 400,
    })
  })
})
