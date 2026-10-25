import { describe, expect, it } from 'vitest'
import {
  currencies,
  formatMoney,
  getTotals,
  laterTotal,
  amountErrorKey,
  isWholeForCurrency,
  parseAmount,
  MAX_AMOUNT,
  isValidAmount,
  safePerDay,
  sum,
} from './money'

describe('sum', () => {
  it('returns 0 for an empty list', () => {
    expect(sum([])).toBe(0)
  })

  it('adds 0.1 and 0.2 to exactly 0.3', () => {
    expect(sum([0.1, 0.2])).toBe(0.3)
  })

  it('handles negative values', () => {
    expect(sum([-5, 2, -1.5])).toBe(-4.5)
  })

  it('rounds to 2 decimals', () => {
    expect(sum([1.005, 1.114])).toBe(2.12)
    expect(sum([0.001])).toBe(0)
  })
})

describe('getTotals', () => {
  const transactions = [
    { id: 1, amount: 1000, currency: 'CRC', type: 'income' },
    { id: 2, amount: 300, currency: 'CRC', type: 'expense' },
    { id: 3, amount: 200.5, currency: 'CRC', type: 'expense' },
    { id: 4, amount: 50, currency: 'USD', type: 'income' },
    { id: 5, amount: 9.99, currency: 'USD', type: 'expense' },
  ]

  it('totals the CRC transactions only', () => {
    expect(getTotals(transactions, 'CRC')).toEqual({
      count: 3,
      income: 1000,
      spent: 500.5,
      net: 499.5,
    })
  })

  it('totals the USD transactions only', () => {
    expect(getTotals(transactions, 'USD')).toEqual({
      count: 2,
      income: 50,
      spent: 9.99,
      net: 40.01,
    })
  })

  it('gives all zeros for a currency with no transactions', () => {
    expect(getTotals([transactions[0]], 'USD')).toEqual({
      count: 0,
      income: 0,
      spent: 0,
      net: 0,
    })
  })
})

describe('safePerDay', () => {
  it('keeps cents for USD', () => {
    expect(safePerDay(0.29, 1, 'USD')).toBe(0.29)
    expect(safePerDay(4.35, 1, 'USD')).toBe(4.35)
    expect(safePerDay(8.2, 2, 'USD')).toBe(4.1)
  })

  it('rounds USD down to the cent', () => {
    expect(safePerDay(10, 3, 'USD')).toBe(3.33)
    expect(safePerDay(90.01, 4, 'USD')).toBe(22.5)
  })

  it('gives whole colones for CRC', () => {
    expect(safePerDay(174900, 4, 'CRC')).toBe(43725)
  })

  it('rounds CRC down', () => {
    expect(safePerDay(100, 3, 'CRC')).toBe(33)
  })
})

describe('formatMoney', () => {
  it('formats colones with dots for thousands', () => {
    expect(formatMoney(1800000)).toBe('₡1.800.000')
    expect(formatMoney(1800000, 'CRC')).toBe('₡1.800.000')
  })

  it('formats dollars with commas and two decimals', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50')
  })

  it('formats zero in both currencies', () => {
    expect(formatMoney(0, 'CRC')).toBe('₡0')
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })

  it('shows colones without decimals and never a minus before zero', () => {
    expect(formatMoney(8500.5, 'CRC')).toBe('₡8.501')
    expect(formatMoney(10.4, 'CRC')).toBe('₡10')
    expect(formatMoney(-0.4, 'CRC')).toBe('₡0')
    expect(formatMoney(-1234.6, 'CRC')).toBe('−₡1.235')
  })

  it('puts the minus sign before the symbol', () => {
    expect(formatMoney(-31000, 'CRC')).toBe('−₡31.000')
    expect(formatMoney(-9.99, 'USD')).toBe('−$9.99')
  })
})

describe('currencies', () => {
  it('has CRC and USD with their symbols', () => {
    expect(currencies.map((c) => [c.code, c.symbol])).toEqual([
      ['CRC', '₡'],
      ['USD', '$'],
    ])
  })
})

describe('parseAmount', () => {
  it('reads empty text as 0', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('   ')).toBe(0)
  })

  it('reads zero as 0', () => {
    expect(parseAmount('0')).toBe(0)
  })

  it('reads decimals with a dot or a comma', () => {
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount('9.99')).toBe(9.99)
    expect(parseAmount('0,5')).toBe(0.5)
  })

  it('ignores spaces around the number', () => {
    expect(parseAmount(' 7 ')).toBe(7)
  })

  // Costa Rican format: the dot groups thousands, the comma is the decimal
  it.each([
    ['1.500', 1500],
    ['1.500.000', 1500000],
    ['1.000.000.000', 1000000000],
    ['1.500,50', 1500.5],
    ['12.345', 12345],
    ['999.999,99', 999999.99],
    ['1500', 1500],
    ['1500,5', 1500.5],
  ])('reads %s as %s', (text, value) => {
    expect(parseAmount(text)).toBe(value)
  })

  it('is null below one cent', () => {
    expect(parseAmount('0.001')).toBeNull()
    expect(parseAmount('0,001')).toBeNull()
  })

  it('is null for negative amounts', () => {
    expect(parseAmount('-1')).toBeNull()
    expect(parseAmount('-0')).toBeNull()
    expect(parseAmount('+5')).toBeNull()
  })

  // hexadecimal, scientific notation and non-numbers never get through
  it.each([
    'abc',
    'Infinity',
    '-Infinity',
    'NaN',
    '1e999',
    '1e5',
    '1e300',
    '1E5',
    '0x10',
    '0b11',
    '1.5.5',
    '1..5',
    '1,500.50',
    '1,500',
    '1.5000',
    '1.50.0',
    '5.',
    '.5',
    '1 000',
    '₡500',
    '12abc',
  ])('rejects %s', (text) => {
    expect(parseAmount(text)).toBeNull()
  })

  it('accepts the cap and rejects anything above it', () => {
    expect(MAX_AMOUNT).toBe(1_000_000_000)
    expect(parseAmount('1000000000')).toBe(MAX_AMOUNT)
    expect(parseAmount('1.000.000.000')).toBe(MAX_AMOUNT)
    expect(parseAmount('1000000000,01')).toBeNull()
    expect(parseAmount('1.000.000.001')).toBeNull()
    expect(parseAmount('99999999999999999999')).toBeNull()
  })

  it('is null when it is not text', () => {
    expect(parseAmount(null)).toBeNull()
    expect(parseAmount(undefined)).toBeNull()
    expect(parseAmount(5)).toBeNull()
  })
})

describe('isWholeForCurrency', () => {
  it('refuses cents in colones only', () => {
    expect(isWholeForCurrency(1500, 'CRC')).toBe(true)
    expect(isWholeForCurrency(0, 'CRC')).toBe(true)
    expect(isWholeForCurrency(100.5, 'CRC')).toBe(false)
    expect(isWholeForCurrency(0.01, 'CRC')).toBe(false)
    expect(isWholeForCurrency(100.5, 'USD')).toBe(true)
  })
})

describe('amountErrorKey', () => {
  it('names the whole-colones message for cents in colones, else the generic one', () => {
    expect(amountErrorKey('100,50', 'CRC')).toBe('svAmountWholeColones')
    expect(amountErrorKey('1.500,50', 'CRC')).toBe('svAmountWholeColones')
    expect(amountErrorKey('abc', 'CRC')).toBe('invalidAmount')
    expect(amountErrorKey('100,50', 'USD')).toBe('invalidAmount')
  })
})

describe('isValidAmount', () => {
  it('accepts amounts from one cent up to the cap', () => {
    expect(isValidAmount(0.01)).toBe(true)
    expect(isValidAmount(250000)).toBe(true)
    expect(isValidAmount(MAX_AMOUNT)).toBe(true)
  })

  it.each([0, -1, 0.001, MAX_AMOUNT + 1, 1e308, 9e15, NaN, Infinity, '5', null])(
    'rejects %s',
    (value) => {
      expect(isValidAmount(value)).toBe(false)
    },
  )
})

describe('laterTotal', () => {
  const today = new Date(2026, 9, 12, 15, 0)
  const tx = (date, amount, type = 'expense', currency = 'CRC') => ({
    date,
    amount,
    type,
    currency,
  })

  it('does not count an expense dated today', () => {
    expect(laterTotal([tx('2026-10-12', 500)], 'CRC', today)).toBe(0)
  })

  it('counts an expense dated tomorrow', () => {
    expect(laterTotal([tx('2026-10-13', 500)], 'CRC', today)).toBe(500)
  })

  it('does not count income', () => {
    expect(laterTotal([tx('2026-10-14', 500, 'income')], 'CRC', today)).toBe(0)
  })

  it('does not count another currency', () => {
    expect(
      laterTotal([tx('2026-10-14', 5, 'expense', 'USD')], 'CRC', today),
    ).toBe(0)
  })

  it('is 0 for an empty list', () => {
    expect(laterTotal([], 'CRC', today)).toBe(0)
  })

  it('does not count past expenses', () => {
    expect(laterTotal([tx('2026-10-11', 500)], 'CRC', today)).toBe(0)
  })

  it('rounds like sum', () => {
    expect(
      laterTotal([tx('2026-10-13', 0.1), tx('2026-10-15', 0.2)], 'CRC', today),
    ).toBe(0.3)
  })

  it('counts later income when asked for it', () => {
    const list = [
      tx('2026-10-13', 500, 'income'),
      tx('2026-10-14', 300),
      tx('2026-10-11', 900, 'income'),
    ]
    expect(laterTotal(list, 'CRC', today, 'income')).toBe(500)
    expect(laterTotal(list, 'CRC', today)).toBe(300)
  })

  it('does not count income of another currency or from today', () => {
    const list = [
      tx('2026-10-14', 5, 'income', 'USD'),
      tx('2026-10-12', 500, 'income'),
    ]
    expect(laterTotal(list, 'CRC', today, 'income')).toBe(0)
  })
})
