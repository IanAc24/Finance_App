import { describe, expect, it } from 'vitest'
import {
  assertBudgetAmount,
  assertCategoryName,
  assertRecurring,
  assertSavingsMove,
  assertTransaction,
} from './validate'

const tx = {
  amount: 1500,
  currency: 'CRC',
  type: 'expense',
  categoryId: 1,
  note: 'Lunch',
  date: '2026-10-12',
}
const move = { amount: 20000, currency: 'CRC', direction: 'in', note: '', date: '2026-10-12' }
const item = { amount: 45000, currency: 'CRC', type: 'expense', categoryId: 3, note: 'Rent', schedule: 'first' }

// The field named by the error that `run` throws, or null when it does not throw
const fieldOf = (run) => {
  try {
    run()
  } catch (error) {
    expect(error.code).toBe('invalidInput')
    return error.field
  }
  return null
}

describe('assertTransaction', () => {
  it('accepts a valid transaction, with or without a note', () => {
    expect(fieldOf(() => assertTransaction(tx))).toBeNull()
    expect(fieldOf(() => assertTransaction({ ...tx, note: undefined }))).toBeNull()
    expect(fieldOf(() => assertTransaction({ ...tx, type: 'income', currency: 'USD', amount: 9.99 }))).toBeNull()
  })

  it('refuses a bad date, currency, type, amount or note', () => {
    expect(fieldOf(() => assertTransaction({ ...tx, date: '2026-02-30' }))).toBe('date')
    expect(fieldOf(() => assertTransaction({ ...tx, date: undefined }))).toBe('date')
    expect(fieldOf(() => assertTransaction({ ...tx, currency: 'EUR' }))).toBe('currency')
    expect(fieldOf(() => assertTransaction({ ...tx, type: 'transfer' }))).toBe('type')
    expect(fieldOf(() => assertTransaction({ ...tx, amount: 0 }))).toBe('amount')
    expect(fieldOf(() => assertTransaction({ ...tx, amount: NaN }))).toBe('amount')
    expect(fieldOf(() => assertTransaction({ ...tx, amount: 2e9 }))).toBe('amount')
    expect(fieldOf(() => assertTransaction({ ...tx, note: 5 }))).toBe('note')
    expect(fieldOf(() => assertTransaction(null))).toBe('item')
  })

  it('counts the note in characters after trimming', () => {
    expect(fieldOf(() => assertTransaction({ ...tx, note: `  ${'a'.repeat(60)}  ` }))).toBeNull()
    expect(fieldOf(() => assertTransaction({ ...tx, note: 'a'.repeat(61) }))).toBe('note')
    // 60 emoji are 120 UTF-16 units but 60 characters
    expect(fieldOf(() => assertTransaction({ ...tx, note: '😀'.repeat(60) }))).toBeNull()
    expect(fieldOf(() => assertTransaction({ ...tx, note: '😀'.repeat(61) }))).toBe('note')
  })
})

describe('assertSavingsMove', () => {
  it('accepts a valid move', () => {
    expect(fieldOf(() => assertSavingsMove(move))).toBeNull()
    expect(fieldOf(() => assertSavingsMove({ ...move, direction: 'out' }))).toBeNull()
  })

  it('refuses a bad direction, date, currency, amount or note', () => {
    expect(fieldOf(() => assertSavingsMove({ ...move, direction: 'sideways' }))).toBe('direction')
    expect(fieldOf(() => assertSavingsMove({ ...move, date: '2026-13-01' }))).toBe('date')
    expect(fieldOf(() => assertSavingsMove({ ...move, currency: 'XYZ' }))).toBe('currency')
    expect(fieldOf(() => assertSavingsMove({ ...move, amount: -5 }))).toBe('amount')
    expect(fieldOf(() => assertSavingsMove({ ...move, note: 'x'.repeat(61) }))).toBe('note')
  })
})

describe('assertRecurring', () => {
  it('accepts every schedule of the app', () => {
    for (const schedule of ['every', 'first', 'second']) {
      expect(fieldOf(() => assertRecurring({ ...item, schedule }))).toBeNull()
    }
  })

  it('refuses an unknown schedule, type, currency or long note', () => {
    expect(fieldOf(() => assertRecurring({ ...item, schedule: 'monthly' }))).toBe('schedule')
    expect(fieldOf(() => assertRecurring({ ...item, type: 'x' }))).toBe('type')
    expect(fieldOf(() => assertRecurring({ ...item, currency: 'x' }))).toBe('currency')
    expect(fieldOf(() => assertRecurring({ ...item, note: 'x'.repeat(61) }))).toBe('note')
  })
})

describe('assertCategoryName', () => {
  it('returns the name trimmed and with its spaces collapsed', () => {
    expect(assertCategoryName('  Mascotas  ')).toBe('Mascotas')
    expect(assertCategoryName('Food   x')).toBe('Food x')
  })

  it('refuses an empty, blank, long or non-text name', () => {
    expect(fieldOf(() => assertCategoryName(''))).toBe('name')
    expect(fieldOf(() => assertCategoryName(' \t  '))).toBe('name')
    expect(fieldOf(() => assertCategoryName(undefined))).toBe('name')
    expect(fieldOf(() => assertCategoryName('a'.repeat(25)))).toBe('name')
    expect(assertCategoryName('a'.repeat(24))).toBe('a'.repeat(24))
  })
})

describe('assertBudgetAmount', () => {
  it('lets 0, none and valid amounts through', () => {
    for (const amount of [0, undefined, null, 1, 50000.5]) {
      expect(fieldOf(() => assertBudgetAmount(amount))).toBeNull()
    }
  })

  it('refuses negative, non-finite, non-numeric and too large amounts', () => {
    for (const amount of [-1, NaN, Infinity, '500', 2e9]) {
      expect(fieldOf(() => assertBudgetAmount(amount))).toBe('amount')
    }
  })
})
