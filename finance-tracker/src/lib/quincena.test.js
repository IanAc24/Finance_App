import { describe, expect, it } from 'vitest'
import {
  availableForSavings,
  isClosingDay,
  nextQuincenaStart,
  quincenaFigures,
  rolloverLeftover,
} from './quincena'

const tx = (date, amount, type = 'expense', currency = 'CRC') => ({
  id: Math.random(),
  date,
  amount,
  type,
  currency,
  categoryId: null,
  note: '',
})
const move = (date, amount, direction = 'in', currency = 'CRC') => ({
  id: Math.random(),
  date,
  amount,
  direction,
  currency,
  note: '',
})
const item = (amount, extra = {}) => ({
  id: 1,
  amount,
  currency: 'CRC',
  type: 'expense',
  categoryId: 3,
  note: 'Rent',
  schedule: 'every',
  lastPeriod: null,
  ...extra,
})
const state = (transactions = [], savings = [], recurring = []) => ({
  transactions,
  savings,
  recurring,
})

describe('quincenaFigures', () => {
  const today = new Date(2026, 9, 20, 12) // Tue 20 Oct: 12 days left (20..31)

  it('splits what is left over the remaining days', () => {
    const f = quincenaFigures(
      state([tx('2026-10-17', 100000, 'income'), tx('2026-10-18', 4000)]),
      'CRC',
      today,
    )
    expect(f.left).toBe(96000)
    expect(f.days).toBe(12)
    expect(f.status).toBe('ok')
    expect(f.perDay).toBe(8000)
  })

  // L2: an income dated after today is not money in hand
  it('does not count an income dated in the future for the daily amount', () => {
    const f = quincenaFigures(
      state([tx('2026-10-30', 300000, 'income'), tx('2026-10-19', 10000)]),
      'CRC',
      today,
    )
    expect(f.left).toBe(290000) // the card still shows the future income
    expect(f.laterIncome).toBe(300000)
    expect(f.inHand).toBe(-10000)
    expect(f.available).toBe(-10000)
    expect(f.status).toBe('waitingIncome')
    expect(f.perDay).toBe(0)
  })

  it('counts an income dated today', () => {
    const f = quincenaFigures(
      state([tx('2026-10-20', 120000, 'income')]),
      'CRC',
      today,
    )
    expect(f.status).toBe('ok')
    expect(f.perDay).toBe(10000)
  })

  it('keeps counting income already received next to a future one', () => {
    const f = quincenaFigures(
      state([tx('2026-10-16', 60000, 'income'), tx('2026-10-28', 40000, 'income')]),
      'CRC',
      today,
    )
    expect(f.inHand).toBe(60000)
    expect(f.perDay).toBe(5000)
  })

  it('takes pending bills out and says so when they exceed what is in hand', () => {
    const ok = quincenaFigures(
      state([tx('2026-10-17', 100000, 'income')], [], [item(40000)]),
      'CRC',
      today,
    )
    expect(ok.available).toBe(60000)
    expect(ok.perDay).toBe(5000)

    const short = quincenaFigures(
      state([tx('2026-10-17', 30000, 'income')], [], [item(40000)]),
      'CRC',
      today,
    )
    expect(short.status).toBe('pendingExceeds')
  })

  it('is over when the money is spent', () => {
    const f = quincenaFigures(
      state([tx('2026-10-17', 1000, 'income'), tx('2026-10-18', 5000)]),
      'CRC',
      today,
    )
    expect(f.status).toBe('over')
  })

  it('subtracts what went to savings and adds what came back', () => {
    const f = quincenaFigures(
      state(
        [tx('2026-10-17', 100000, 'income')],
        [move('2026-10-17', 30000), move('2026-10-18', 5000, 'out')],
      ),
      'CRC',
      today,
    )
    expect(f.left).toBe(75000)
  })

  it('keeps currencies apart', () => {
    const f = quincenaFigures(
      state([tx('2026-10-17', 100, 'income', 'USD')]),
      'CRC',
      today,
    )
    expect(f.count).toBe(0)
    expect(f.left).toBe(0)
  })

  it('divides dollars in cents', () => {
    const f = quincenaFigures(
      state([tx('2026-10-17', 100, 'income', 'USD')]),
      'USD',
      today,
    )
    expect(f.perDay).toBe(8.33)
  })
})

describe('rolloverLeftover', () => {
  // 16 Oct: the previous quincena is 1-15 Oct
  const today = new Date(2026, 9, 16, 9)

  it('is what the closing quincena had left', () => {
    const left = rolloverLeftover(
      state([tx('2026-10-01', 200000, 'income'), tx('2026-10-05', 50000)]),
      'CRC',
      today,
    )
    expect(left).toBe(150000)
  })

  // L1: the pay of the 15th is for the quincena that starts, not a leftover
  it('does not count an income dated on the last day of the closing quincena', () => {
    const left = rolloverLeftover(
      state([tx('2026-10-15', 400000, 'income'), tx('2026-10-16', 5000)]),
      'CRC',
      today,
    )
    expect(left).toBe(0)
  })

  it('still offers what the earlier income left, without the closing-day pay', () => {
    const left = rolloverLeftover(
      state([
        tx('2026-10-01', 100000, 'income'),
        tx('2026-10-10', 30000),
        tx('2026-10-15', 400000, 'income'),
      ]),
      'CRC',
      today,
    )
    expect(left).toBe(70000)
  })

  it('does not offer a leftover when the closing-day pay was partly saved', () => {
    const left = rolloverLeftover(
      state(
        [tx('2026-10-15', 400000, 'income')],
        [move('2026-10-15', 100000)],
      ),
      'CRC',
      today,
    )
    expect(left).toBeLessThanOrEqual(0)
  })

  it('works at the end of a month (income dated the 31st)', () => {
    const left = rolloverLeftover(
      state([tx('2026-10-31', 500000, 'income'), tx('2026-10-20', 2000)]),
      'CRC',
      new Date(2026, 10, 1),
    )
    expect(left).toBe(-2000)
  })

  it('is zero once the leftover was moved to savings', () => {
    const left = rolloverLeftover(
      state(
        [tx('2026-10-01', 200000, 'income'), tx('2026-10-05', 50000)],
        [move('2026-10-15', 150000)],
      ),
      'CRC',
      today,
    )
    expect(left).toBe(0)
  })

  it('ignores another currency', () => {
    const left = rolloverLeftover(
      state([tx('2026-10-15', 400, 'income', 'USD')]),
      'CRC',
      today,
    )
    expect(left).toBe(0)
  })
})

describe('isClosingDay / nextQuincenaStart', () => {
  it.each([
    ['2026-10-15', true],
    ['2026-10-31', true],
    ['2026-02-28', true],
    ['2028-02-29', true],
    ['2026-10-14', false],
    ['2026-10-16', false],
    ['2026-10-30', false],
    ['nope', false],
    [null, false],
  ])('isClosingDay(%s) is %s', (date, expected) => {
    expect(isClosingDay(date)).toBe(expected)
  })

  it('gives the first day of the next quincena', () => {
    expect(nextQuincenaStart('2026-10-15')).toBe('2026-10-16')
    expect(nextQuincenaStart('2026-10-31')).toBe('2026-11-01')
    expect(nextQuincenaStart('2026-12-31')).toBe('2027-01-01')
    expect(nextQuincenaStart('2026-10-02')).toBe('2026-10-16')
  })
})

describe('availableForSavings', () => {
  it('is what is in hand and never negative', () => {
    expect(availableForSavings({ inHand: 5000 })).toBe(5000)
    expect(availableForSavings({ inHand: -300 })).toBe(0)
  })

  it('leaves out an income that has not arrived', () => {
    const f = quincenaFigures(
      state([tx('2026-10-17', 20000, 'income'), tx('2026-10-30', 100000, 'income')]),
      'CRC',
      new Date(2026, 9, 20),
    )
    expect(availableForSavings(f)).toBe(20000)
  })
})

// L5: the savings goal of the profile is set aside before the daily amount
describe('quincenaFigures with a savings goal', () => {
  const today = new Date(2026, 9, 20, 12) // 12 days left (20..31)
  const withGoal = (txs, goal, currency = 'CRC', savings = []) => ({
    ...state(txs, savings),
    profile: { savingsGoal: goal, currency },
  })

  it('does not change anything without a goal', () => {
    const f = quincenaFigures(state([tx('2026-10-17', 96000, 'income')]), 'CRC', today)
    expect(f.reserve).toBe(0)
    expect(f.perDay).toBe(8000)
    expect(f.perDayFull).toBe(8000)
  })

  it('sets the goal aside before dividing by the days left', () => {
    const f = quincenaFigures(
      withGoal([tx('2026-10-17', 96000, 'income')], 36000),
      'CRC',
      today,
    )
    expect(f.reserve).toBe(36000)
    expect(f.perDayFull).toBe(8000)
    expect(f.perDay).toBe(5000) // (96000 - 36000) / 12
  })

  it('counts what was already moved to savings this quincena toward the goal', () => {
    // 36000 goal, 12000 already saved: left is 84000, still 24000 to set aside
    const f = quincenaFigures(
      withGoal(
        [tx('2026-10-17', 96000, 'income')],
        36000,
        'CRC',
        [move('2026-10-18', 12000)],
      ),
      'CRC',
      today,
    )
    expect(f.left).toBe(84000)
    expect(f.reserve).toBe(24000)
    expect(f.perDay).toBe(5000) // (84000 - 24000) / 12
  })

  it('stops reserving once the goal is met', () => {
    const f = quincenaFigures(
      withGoal(
        [tx('2026-10-17', 96000, 'income')],
        20000,
        'CRC',
        [move('2026-10-18', 25000)],
      ),
      'CRC',
      today,
    )
    expect(f.reserve).toBe(0)
    expect(f.perDay).toBe(5916) // 71000 / 12 rounded down
  })

  it('never reserves more than what is available', () => {
    const f = quincenaFigures(
      withGoal([tx('2026-10-17', 10000, 'income')], 50000),
      'CRC',
      today,
    )
    expect(f.reserve).toBe(10000)
    expect(f.status).toBe('ok')
    expect(f.perDay).toBe(0)
    expect(f.perDayFull).toBe(833)
  })

  it('does not touch the other currency', () => {
    const f = quincenaFigures(
      withGoal([tx('2026-10-17', 120, 'income', 'USD')], 50000, 'CRC'),
      'USD',
      today,
    )
    expect(f.goal).toBe(0)
    expect(f.reserve).toBe(0)
    expect(f.perDay).toBe(10)
  })

  it('reserves nothing when there is nothing available', () => {
    const f = quincenaFigures(withGoal([tx('2026-10-17', 5000)], 30000), 'CRC', today)
    expect(f.reserve).toBe(0)
    expect(f.status).toBe('over')
    expect(f.perDay).toBe(0)
  })

  it('also takes pending bills out before the goal', () => {
    const f = quincenaFigures(
      { ...withGoal([tx('2026-10-17', 96000, 'income')], 36000), recurring: [item(12000)] },
      'CRC',
      today,
    )
    expect(f.available).toBe(84000)
    expect(f.reserve).toBe(36000)
    expect(f.perDay).toBe(4000) // (84000 - 36000) / 12
  })
})
