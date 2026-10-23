import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'
import { THIN, budgetPercent, shareText, splitMoney } from './moneyDisplay'

const join = ({ sign, symbol, whole, decimals }) => sign + symbol + whole + decimals

describe('splitMoney', () => {
  const cases = [
    [0, 'CRC'],
    [0, 'USD'],
    [5, 'CRC'],
    [174900, 'CRC'],
    [-31000, 'CRC'],
    [1000000000, 'CRC'],
    [-1000000000, 'CRC'],
    [1234.5, 'USD'],
    [-0.5, 'USD'],
    [123456789, 'USD'],
    [1000000000, 'USD'],
  ]

  it.each(cases)('joins back to formatMoney(%s, %s) exactly', (amount, code) => {
    const text = formatMoney(amount, code)
    expect(join(splitMoney(text))).toBe(text)
  })

  it('splits colones into sign, symbol and number with no decimals', () => {
    expect(splitMoney('−₡31.000')).toEqual({
      sign: '−',
      symbol: '₡',
      whole: '31.000',
      decimals: '',
    })
    expect(splitMoney('₡1.000.000.000').whole).toBe('1.000.000.000')
    expect(splitMoney('₡1.000.000.000').decimals).toBe('')
  })

  it('splits dollars into the whole part and the decimals', () => {
    expect(splitMoney('$1,234.50')).toEqual({
      sign: '',
      symbol: '$',
      whole: '1,234',
      decimals: '.50',
    })
    expect(splitMoney('−$0.50')).toEqual({
      sign: '−',
      symbol: '$',
      whole: '0',
      decimals: '.50',
    })
  })

  it('returns text it does not know as one piece', () => {
    expect(splitMoney('abc')).toEqual({ sign: '', symbol: '', whole: 'abc', decimals: '' })
  })
})

describe('shareText', () => {
  it('rounds to a whole percent', () => {
    expect(shareText(1, 3)).toBe('33%')
    expect(shareText(2, 3)).toBe('67%')
    expect(shareText(5, 5)).toBe('100%')
  })

  it('says <1% for a tiny real share and 0% for none', () => {
    expect(shareText(1, 1000)).toBe('<1%')
    expect(shareText(0, 100)).toBe('0%')
    expect(shareText(10, 0)).toBe('0%')
  })
})

describe('budgetPercent', () => {
  it('rounds down so an almost spent budget never reads 100%', () => {
    expect(budgetPercent(19900 / 20000)).toBe(99)
    expect(budgetPercent(0.995)).toBe(99)
  })

  it('shows 100 at the limit and the real percent above it', () => {
    expect(budgetPercent(1)).toBe(100)
    expect(budgetPercent(1.012)).toBe(101)
  })

  it('keeps exact percents exact despite floating point', () => {
    expect(budgetPercent(0.58)).toBe(58)
    expect(budgetPercent(0.29)).toBe(29)
    expect(budgetPercent(0.8)).toBe(80)
  })
})

describe('THIN', () => {
  it('is one thin space, so a sign and its money stay on one line', () => {
    expect(THIN).toBe('\u2009')
    expect(`−${THIN}₡6.400`).toHaveLength(8)
  })
})
