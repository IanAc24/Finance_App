import { describe, expect, it } from 'vitest'
import {
  leftInRange,
  previousQuincenaRange,
  rolloverSkipKey,
  savingsBalance,
  savingsInRange,
} from './savings'

describe('rolloverSkipKey', () => {
  it('keeps the key saved on devices', () => {
    expect(rolloverSkipKey('CRC')).toBe('rolloverSkipped.CRC')
    expect(rolloverSkipKey('USD')).toBe('rolloverSkipped.USD')
  })
})

function ymd(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
}

const move = (id, direction, amount, date, currency = 'CRC') => ({
  id,
  amount,
  currency,
  direction,
  note: '',
  date,
})

const tx = (id, type, amount, date, currency = 'CRC') => ({
  id,
  amount,
  currency,
  type,
  categoryId: null,
  note: '',
  date,
})

describe('savingsBalance', () => {
  it('is 0 for an empty list', () => {
    expect(savingsBalance([], 'CRC')).toBe(0)
    expect(savingsBalance([], 'USD')).toBe(0)
  })

  it('subtracts what was taken out from what was moved in', () => {
    const moves = [
      move(1, 'in', 50000, '2026-10-01'),
      move(2, 'in', 25000.5, '2026-10-05'),
      move(3, 'out', 10000, '2026-10-08'),
    ]
    expect(savingsBalance(moves, 'CRC')).toBe(65000.5)
  })

  it('keeps each currency apart', () => {
    const moves = [
      move(1, 'in', 50000, '2026-10-01'),
      move(2, 'in', 100.1, '2026-10-02', 'USD'),
      move(3, 'out', 0.2, '2026-10-03', 'USD'),
      move(4, 'out', 5000, '2026-10-04'),
    ]
    expect(savingsBalance(moves, 'CRC')).toBe(45000)
    expect(savingsBalance(moves, 'USD')).toBe(99.9)
  })

  it('can be negative', () => {
    expect(savingsBalance([move(1, 'out', 10, '2026-10-01')], 'CRC')).toBe(-10)
  })
})

describe('savingsInRange', () => {
  const first = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 15, 23, 59, 59) }
  const second = { start: new Date(2026, 9, 16), end: new Date(2026, 9, 31, 23, 59, 59) }

  it('puts the 15th in the first quincena and the 16th in the second', () => {
    const moves = [move(1, 'in', 10, '2026-10-15'), move(2, 'in', 20, '2026-10-16')]
    expect(savingsInRange(moves, 'CRC', first.start, first.end)).toEqual({
      toSavings: 10,
      fromSavings: 0,
    })
    expect(savingsInRange(moves, 'CRC', second.start, second.end)).toEqual({
      toSavings: 20,
      fromSavings: 0,
    })
  })

  it('includes the first and last day of the period', () => {
    const moves = [
      move(1, 'in', 1, '2026-10-01'),
      move(2, 'out', 2, '2026-10-15'),
      move(3, 'in', 4, '2026-09-30'),
    ]
    expect(savingsInRange(moves, 'CRC', first.start, first.end)).toEqual({
      toSavings: 1,
      fromSavings: 2,
    })
  })

  it('ignores moves of the other currency', () => {
    const moves = [
      move(1, 'in', 10, '2026-10-05'),
      move(2, 'in', 99, '2026-10-05', 'USD'),
      move(3, 'out', 7, '2026-10-06', 'USD'),
    ]
    expect(savingsInRange(moves, 'CRC', first.start, first.end)).toEqual({
      toSavings: 10,
      fromSavings: 0,
    })
    expect(savingsInRange(moves, 'USD', first.start, first.end)).toEqual({
      toSavings: 99,
      fromSavings: 7,
    })
  })

  it('rounds like sum', () => {
    const moves = [move(1, 'in', 0.1, '2026-10-05'), move(2, 'in', 0.2, '2026-10-06')]
    expect(savingsInRange(moves, 'CRC', first.start, first.end).toSavings).toBe(0.3)
  })
})

describe('leftInRange', () => {
  const start = new Date(2026, 9, 1)
  const end = new Date(2026, 9, 15, 23, 59, 59)

  it('combines income, spending, moves in and moves out', () => {
    const transactions = [
      tx(1, 'income', 1000, '2026-10-01'),
      tx(2, 'expense', 300, '2026-10-05'),
    ]
    const moves = [move(1, 'in', 200, '2026-10-06'), move(2, 'out', 50, '2026-10-07')]
    expect(leftInRange(transactions, moves, 'CRC', start, end)).toBe(550)
  })

  it('ignores items outside the period and in the other currency', () => {
    const transactions = [
      tx(1, 'income', 1000, '2026-10-15'),
      tx(2, 'income', 500, '2026-10-16'),
      tx(3, 'expense', 400, '2026-09-30'),
      tx(4, 'expense', 77, '2026-10-02', 'USD'),
    ]
    const moves = [
      move(1, 'in', 100, '2026-10-16'),
      move(2, 'out', 60, '2026-09-30'),
      move(3, 'in', 9, '2026-10-02', 'USD'),
    ]
    expect(leftInRange(transactions, moves, 'CRC', start, end)).toBe(1000)
    expect(leftInRange(transactions, moves, 'USD', start, end)).toBe(-86)
  })

  it('is 0 with nothing', () => {
    expect(leftInRange([], [], 'CRC', start, end)).toBe(0)
  })
})

describe('previousQuincenaRange', () => {
  const range = (today) => {
    const { start, end } = previousQuincenaRange(today)
    return [ymd(start), ymd(end)]
  }

  it('from the 1st goes to the second half of the previous month', () => {
    expect(range(new Date(2026, 9, 1))).toEqual([
      [2026, 9, 16],
      [2026, 9, 30],
    ])
  })

  it('from the 15th goes to the second half of the previous month', () => {
    expect(range(new Date(2026, 9, 15))).toEqual([
      [2026, 9, 16],
      [2026, 9, 30],
    ])
  })

  it('from the 16th goes to the first half of the same month', () => {
    expect(range(new Date(2026, 9, 16))).toEqual([
      [2026, 10, 1],
      [2026, 10, 15],
    ])
  })

  it('from the last day goes to the first half of the same month', () => {
    expect(range(new Date(2026, 9, 31))).toEqual([
      [2026, 10, 1],
      [2026, 10, 15],
    ])
  })

  it('crosses the start of a year', () => {
    expect(range(new Date(2026, 0, 10))).toEqual([
      [2025, 12, 16],
      [2025, 12, 31],
    ])
  })

  it('handles a short February', () => {
    expect(range(new Date(2026, 2, 3))).toEqual([
      [2026, 2, 16],
      [2026, 2, 28],
    ])
  })
})
