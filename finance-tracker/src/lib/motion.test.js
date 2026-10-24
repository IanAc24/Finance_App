import { beforeEach, describe, expect, it } from 'vitest'
import { formatMoney } from './money'
import {
  countUpValue,
  diffList,
  easeOut,
  forgetLists,
  interpolate,
  recallList,
  rememberList,
  shouldCountUp,
} from './motion'

describe('easing and interpolation', () => {
  it('easeOut runs from 0 to 1, fast at the start', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
    expect(easeOut(-3)).toBe(0)
    expect(easeOut(7)).toBe(1)
  })

  it('easeOut never goes backwards', () => {
    let last = 0
    for (let i = 1; i <= 100; i++) {
      const value = easeOut(i / 100)
      expect(value).toBeGreaterThanOrEqual(last)
      last = value
    }
  })

  it('interpolate ends exactly on both ends', () => {
    expect(interpolate(10, 20, 0)).toBe(10)
    expect(interpolate(10, 20, 1)).toBe(20)
    expect(interpolate(10, 20, 0.5)).toBe(15)
  })
})

describe('countUpValue', () => {
  it('starts on the old number, ends exactly on the new one', () => {
    expect(countUpValue(1000, 2500.55, 0, 600)).toBe(1000)
    expect(countUpValue(1000, 2500.55, 600, 600)).toBe(2500.55)
    expect(countUpValue(1000, 2500.55, 9000, 600)).toBe(2500.55)
  })

  it('counts down too, and stays between both numbers', () => {
    for (let elapsed = 0; elapsed <= 600; elapsed += 50) {
      const value = countUpValue(5000, 100, elapsed, 600)
      expect(value).toBeLessThanOrEqual(5000)
      expect(value).toBeGreaterThanOrEqual(100)
    }
  })

  it('a zero duration jumps to the end', () => {
    expect(countUpValue(1, 9, 0, 0)).toBe(9)
  })

  it('every step formats as a well-formed amount in both currencies', () => {
    for (let elapsed = 0; elapsed <= 600; elapsed += 40) {
      const crc = formatMoney(countUpValue(0, 1234567.89, elapsed, 600), 'CRC')
      const usd = formatMoney(countUpValue(0, 1234.5, elapsed, 600), 'USD')
      expect(crc).toMatch(/^₡\d{1,3}(\.\d{3})*$/)
      expect(usd).toMatch(/^\$\d{1,3}(,\d{3})*\.\d{2}$/)
    }
    expect(formatMoney(countUpValue(0, 1234567.89, 600, 600), 'CRC')).toBe('₡1.234.568')
    expect(formatMoney(countUpValue(0, 1234.5, 600, 600), 'USD')).toBe('$1,234.50')
  })
})

describe('shouldCountUp', () => {
  it('only when the value changed', () => {
    expect(shouldCountUp(100, 100, false)).toBe(false)
    expect(shouldCountUp(100, 200, false)).toBe(true)
  })

  it('never with reduced motion or a value that is not a number', () => {
    expect(shouldCountUp(100, 200, true)).toBe(false)
    expect(shouldCountUp(NaN, 200, false)).toBe(false)
    expect(shouldCountUp(100, Infinity, false)).toBe(false)
  })
})

describe('diffList', () => {
  const key = (item) => item.id
  const sig = (item) => `${item.amount}|${item.note}`
  const entries = (list) => list.map((item) => ({ key: key(item), signature: sig(item), item }))
  const a = { id: 1, amount: 10, note: 'a' }
  const b = { id: 2, amount: 20, note: 'b' }
  const c = { id: 3, amount: 30, note: 'c' }

  it('finds nothing in an identical list', () => {
    const diff = diffList(entries([a, b]), [a, b], key, sig)
    expect(diff).toEqual({ entered: [], edited: [], removed: [] })
  })

  it('finds new, edited and removed rows', () => {
    const diff = diffList(entries([a, b]), [{ ...a, amount: 11 }, c], key, sig)
    expect(diff.entered).toEqual([3])
    expect(diff.edited).toEqual([1])
    expect(diff.removed).toEqual([{ key: 2, item: b, index: 1 }])
  })
})

describe('memory of the last list', () => {
  beforeEach(forgetLists)

  it('recalls the same id and scope', () => {
    rememberList('income', 'month|CRC', [{ key: 1 }], 1000)
    expect(recallList('income', 'month|CRC', 2000)).toEqual([{ key: 1 }])
  })

  it('forgets another scope, another id and old entries', () => {
    rememberList('income', 'month|CRC', [{ key: 1 }], 1000)
    expect(recallList('income', 'year|CRC', 2000)).toBeNull()
    expect(recallList('other', 'month|CRC', 2000)).toBeNull()
    expect(recallList('income', 'month|CRC', 1000 + 6 * 60 * 1000)).toBeNull()
  })

  it('knows nothing after a reload (empty memory)', () => {
    expect(recallList('income', 'month|CRC')).toBeNull()
  })
})
