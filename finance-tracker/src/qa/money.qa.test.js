// QA (Agent B): money boundaries, parsing, keypad, formatting, totals, percents,
// backup and CSV. Expected values are computed here with integer cents / BigInt,
// never with the code under test.
import { describe, expect, it } from 'vitest'
import {
  MAX_AMOUNT,
  MAX_CENTS,
  formatMoney,
  getTotals,
  isValidAmount,
  parseAmount,
  safePerDay,
  sum,
} from '../lib/money'
import { applyKey, formatTyping, keypadKeys } from '../lib/keypad'
import { budgetPercent, shareText, splitMoney } from '../lib/moneyDisplay'
import { buildBackup, inspectBackup } from '../lib/backup'
import { transactionRows } from '../lib/csv'
import { savingsBalance } from '../lib/savings'
import { QA_SEED, mulberry32, randInt } from './seed'

const builtIn = [
  { id: 1, key: 'food', color: 'orange' },
  { id: 2, key: 'transport', color: 'blue' },
  { id: 3, key: 'bills', color: 'violet' },
  { id: 4, key: 'fun', color: 'lime' },
]
const tr = (k) => k

// independent grouping of an integer string: 1234567 -> '1,234,567'
function group(intText, sep) {
  let out = ''
  for (let i = 0; i < intText.length; i++) {
    if (i > 0 && (intText.length - i) % 3 === 0) out += sep
    out += intText[i]
  }
  return out
}
// independent expected text from integer cents
function expectedUsd(cents) {
  const neg = cents < 0
  const c = Math.abs(cents)
  const whole = Math.floor(c / 100)
  const frac = String(c % 100).padStart(2, '0')
  return `${neg ? '−' : ''}$${group(String(whole), ',')}.${frac}`
}
// independent plain-decimal text of cents without trailing zeros: 1050 -> '10.5'
function plainCents(c) {
  const intPart = Math.floor(c / 100)
  const frac = String(c % 100).padStart(2, '0').replace(/0+$/, '')
  return frac ? `${intPart}.${frac}` : `${intPart}`
}

describe('MAX limits', () => {
  it('MAX_AMOUNT is 1e9 and MAX_CENTS 1e11', () => {
    expect(MAX_AMOUNT).toBe(1_000_000_000)
    expect(MAX_CENTS).toBe(100_000_000_000)
  })
})

describe('isValidAmount boundaries', () => {
  const valid = [0.01, 0.1, 0.99, 1, 10.5, 99.99, 100, 999.99, 1000, 10000, 999999.99, MAX_AMOUNT]
  it.each(valid)('accepts %s', (v) => expect(isValidAmount(v)).toBe(true))
  const invalid = [0, 0.004, -0.01, -1, MAX_AMOUNT + 0.01, MAX_AMOUNT + 1, NaN, Infinity, -Infinity, '5', null, undefined, '', [], {}]
  it.each(invalid)('rejects %s', (v) => expect(isValidAmount(v)).toBe(false))
})

describe('parseAmount: zero vs missing vs invalid', () => {
  it('empty / blank is 0 (missing)', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('   ')).toBe(0)
  })
  it('non-strings are invalid (null)', () => {
    for (const v of [undefined, null, 5, NaN, {}, []]) expect(parseAmount(v)).toBeNull()
  })
  it('explicit zeros read as 0 (same as empty)', () => {
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('0.00')).toBe(0)
    expect(parseAmount('0,0')).toBe(0)
  })
  const cases = [
    ['0.01', 0.01], ['0,01', 0.01], ['0.10', 0.1], ['0.99', 0.99], ['1', 1], ['1.00', 1],
    ['10.50', 10.5], ['10,50', 10.5], ['99.99', 99.99], ['100', 100], ['999.99', 999.99],
    ['1000', 1000], ['10000', 10000], ['999999.99', 999999.99],
    ['1000000000', MAX_AMOUNT],
    // Costa Rican format
    ['1.500', 1500], ['1.500.000', 1500000], ['1.500,50', 1500.5], ['12,5', 12.5],
    ['12.5', 12.5], ['9.99', 9.99], ['1.000.000.000', MAX_AMOUNT], ['  12  ', 12],
    ['999.999,99', 999999.99], ['1.000', 1000],
    // by the app's own rule a dot + exactly 3 digits is a thousands group
    ['12.345', 12345],
    ['00012', 12],
  ]
  it.each(cases)('parses %j -> %s', (text, expected) => {
    expect(parseAmount(text)).toBe(expected)
  })
  const rejected = [
    'abc', '1,2,3', '1e5', '1E5', '0x10', '-5', '+5', '--5', '5-', '12.3456', '1.5e3',
    '.5', ',5', '5.', '5,', '0.500', '1,500', '1,500.00', '1 500', '1.50.0', '1..5', '12.5.5',
    '1000000000.01', '1.000.000.001', '1000000001', '0.001', '0,004', 'NaN', 'Infinity',
    '₡500', '$5', '5%', '１２', '1_000',
  ]
  it.each(rejected)('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNull()
  })
  it('MAX_AMOUNT is the limit, one cent above is rejected', () => {
    expect(parseAmount(String(MAX_AMOUNT))).toBe(MAX_AMOUNT)
    expect(parseAmount('1000000000.01')).toBeNull()
  })
})

describe('keypad (applyKey)', () => {
  const run = (keys, currency) => keys.reduce((t, k) => applyKey(t, k, currency), '')
  const nines = Array(10).fill('9')
  const seqCases = [
    // [currency, keys, expected text]
    ['CRC', ['1', '000'], '1000'],
    ['CRC', ['0', '0', '0'], '0'],
    ['CRC', ['0', '5'], '5'],
    ['CRC', ['000'], ''],
    ['CRC', ['0', '000'], '0'],
    ['CRC', ['1', '.', '5'], '15'], // point does nothing in colones
    ['CRC', ['1', ',', '5'], '15'],
    ['CRC', ['3', '6', '0', '0', '⌫'], '360'],
    ['CRC', ['⌫'], ''],
    ['CRC', ['1', '000', '000', '000'], '1000000000'],
    ['CRC', ['1', '000', '000', '000', '0'], '1000000000'], // above cap: ignored
    ['CRC', ['1', '000', '000', '000', '000'], '1000000000'],
    ['CRC', nines, '999999999'], // 10th 9 would be 9,999,999,999: ignored
    ['CRC', ['1', 'x', '2'], '12'], // unknown key ignored
    ['USD', ['.'], '0.'],
    ['USD', [',', '5'], '0.5'],
    ['USD', ['1', '.', '5', '0'], '1.50'],
    ['USD', ['1', '.', '5', '0', '5'], '1.50'], // third decimal ignored
    ['USD', ['1', '.', '.', '5'], '1.5'], // second point ignored
    ['USD', ['0', '.', '0', '1'], '0.01'],
    ['USD', ['0', '.', '0', '0'], '0.00'],
    ['USD', ['1', '.', '0', '000'], '1.0'], // 000 inside decimals ignored
    ['USD', ['1', '000', '.', '9', '9'], '1000.99'],
    ['USD', ['0', '0', '0', '7'], '7'],
    ['USD', ['.', '⌫'], '0'],
    ['USD', ['.', '⌫', '⌫'], ''],
    ['USD', ['1', '.', '5', '⌫', '⌫'], '1'],
    ['USD', ['1', '000', '000', '000'], '1000000000'],
    ['USD', ['1', '000', '000', '000', '.', '0', '0'], '1000000000.00'],
    ['USD', ['1', '000', '000', '000', '.', '0', '1'], '1000000000.0'], // .01 above cap rejected
    ['USD', ['9', '9', '9', '9', '9', '9', '9', '9', '9', '.', '9', '9'], '999999999.99'],
  ]
  it.each(seqCases)('%s %j -> %j', (currency, keys, expected) => {
    expect(run(keys, currency)).toBe(expected)
  })
  it('keys: USD has the point, CRC has 000', () => {
    expect(keypadKeys('USD')).toContain('.')
    expect(keypadKeys('USD')).not.toContain('000')
    expect(keypadKeys('CRC')).toContain('000')
    expect(keypadKeys('CRC')).not.toContain('.')
  })
  it('typed text converts to the expected amount (parseFloat, as the screen does)', () => {
    expect(parseFloat(run(['1', '.', '1', '0'], 'USD'))).toBe(1.1)
    expect(parseFloat(run(['2', '000'], 'CRC'))).toBe(2000)
  })
  it('formatTyping groups per currency', () => {
    expect(formatTyping('3600', 'CRC')).toBe('3.600')
    expect(formatTyping('1000000000', 'CRC')).toBe('1.000.000.000')
    expect(formatTyping('1234.5', 'USD')).toBe('1,234.5')
    expect(formatTyping('0.', 'USD')).toBe('0.')
    expect(formatTyping('', 'USD')).toBe('')
    expect(formatTyping('999', 'CRC')).toBe('999')
  })
  it('random key sequences always yield a well-formed, in-range text', () => {
    const rand = mulberry32(QA_SEED)
    const keys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '.', ',', '⌫', 'x', '']
    for (const currency of ['CRC', 'USD']) {
      for (let n = 0; n < 300; n++) {
        let text = ''
        const log = []
        for (let i = 0; i < 40; i++) {
          const k = keys[randInt(rand, 0, keys.length - 1)]
          log.push(k)
          text = applyKey(text, k, currency)
          const ctx = `seed=${QA_SEED} ${currency} keys=${JSON.stringify(log)} text=${text}`
          expect(/^(0|[1-9]\d*)?(\.\d{0,2})?$/.test(text), ctx).toBe(true)
          if (currency === 'CRC') expect(text.includes('.'), ctx).toBe(false)
          expect(Number(text || '0') <= MAX_AMOUNT, ctx).toBe(true)
        }
      }
    }
  })
  it('a finished keypad text parses with parseAmount as the same number', () => {
    for (const text of ['1500', '12.5', '0.01', '1000000000', '0']) {
      expect(parseAmount(text)).toBe(parseFloat(text))
    }
  })
})

describe('formatMoney', () => {
  it('CRC: whole colones with dot thousands', () => {
    const cases = [
      [0, '₡0'], [1, '₡1'], [999, '₡999'], [1000, '₡1.000'], [10000, '₡10.000'],
      [999999.99, '₡1.000.000'], [1800000, '₡1.800.000'], [MAX_AMOUNT, '₡1.000.000.000'],
      [-31000, '−₡31.000'], [-1, '−₡1'], [0.4, '₡0'], [-0.4, '₡0'], [0.5, '₡1'], [-0.5, '−₡1'],
      [0.01, '₡0'], [100, '₡100'], [99.99, '₡100'],
    ]
    for (const [amount, text] of cases) expect(formatMoney(amount, 'CRC'), `CRC ${amount}`).toBe(text)
    expect(formatMoney(1500)).toBe('₡1.500') // default is CRC
  })
  it('USD: two decimals, comma thousands, minus sign', () => {
    const centsList = [0, 1, 10, 99, 100, 1050, 9999, 10000, 99999, 100000, 1000000, 99999999, 100_000_000_000, -1, -100, -123456]
    for (const c of centsList) {
      expect(formatMoney(c / 100, 'USD'), `USD ${c} cents`).toBe(expectedUsd(c))
    }
  })
  it('USD every cent value 0..30000 formats exactly', () => {
    for (let c = 0; c <= 30000; c++) {
      expect(formatMoney(c / 100, 'USD')).toBe(expectedUsd(c))
    }
  })
  it('splitMoney parts join back to the exact text', () => {
    const texts = [
      ...[0, 1, 999, 1000, 1234567, MAX_AMOUNT, -31000, -1, 0.4].map((a) => formatMoney(a, 'CRC')),
      ...[0, 0.01, 0.1, 1234.5, 999999.99, MAX_AMOUNT, -5, -0.01, -1234567.89].map((a) => formatMoney(a, 'USD')),
    ]
    for (const text of texts) {
      const p = splitMoney(text)
      expect(p.sign + p.symbol + p.whole + p.decimals, text).toBe(text)
    }
    expect(splitMoney('$1,234.50')).toEqual({ sign: '', symbol: '$', whole: '1,234', decimals: '.50' })
    expect(splitMoney('−₡31.000')).toEqual({ sign: '−', symbol: '₡', whole: '31.000', decimals: '' })
    expect(splitMoney('₡1.000').decimals).toBe('')
  })
})

describe('sum / cents round trip / totals', () => {
  it('100 x $0.10 is exactly $10.00', () => {
    const list = Array.from({ length: 100 }, () => 0.1)
    expect(sum(list)).toBe(10)
    const txs = list.map((amount, id) => ({ id, amount, currency: 'USD', type: 'expense', date: '2026-10-01' }))
    expect(getTotals(txs, 'USD')).toEqual({ count: 100, income: 0, spent: 10, net: -10 })
    expect(formatMoney(getTotals(txs, 'USD').spent, 'USD')).toBe('$10.00')
  })
  it('1000 x 0.01 is exactly 10 and 10000 x 0.01 is 100', () => {
    expect(sum(Array(1000).fill(0.01))).toBe(10)
    expect(sum(Array(10000).fill(0.01))).toBe(100)
  })
  it('0.1 + 0.2 = 0.3, and sum([]) = 0', () => {
    expect(sum([0.1, 0.2])).toBe(0.3)
    expect(sum([])).toBe(0)
  })
  it('amount -> cents -> amount is exact for every cent 1..300000 and random large ones', () => {
    // same formula storage.js/cloudStorage.js use: Math.round(amount*100) then /100
    for (let c = 1; c <= 300000; c++) {
      const amount = c / 100
      expect(Math.round(amount * 100), `cents ${c}`).toBe(c)
      expect(Math.round(amount * 100) / 100).toBe(amount)
    }
    const rand = mulberry32(QA_SEED)
    for (let i = 0; i < 20000; i++) {
      const c = randInt(rand, 1, MAX_CENTS)
      const amount = c / 100
      expect(Math.round(amount * 100), `seed=${QA_SEED} cents ${c}`).toBe(c)
      expect(isValidAmount(amount), `valid ${c}`).toBe(true)
    }
  })
  it('parseAmount of the plain decimal text of every cent gives the same cents', () => {
    for (let c = 1; c <= 200000; c++) {
      const text = `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`
      expect(Math.round(parseAmount(text) * 100), text).toBe(c)
    }
  })
  it('sum of 100 x MAX_AMOUNT stays exact', () => {
    expect(sum(Array(100).fill(MAX_AMOUNT))).toBe(1e11)
  })
  it('mixed currencies are never added together', () => {
    const txs = [
      { id: 1, amount: 1500, currency: 'CRC', type: 'income', date: '2026-10-01' },
      { id: 2, amount: 10.1, currency: 'USD', type: 'income', date: '2026-10-01' },
      { id: 3, amount: 500.25, currency: 'CRC', type: 'expense', date: '2026-10-01' },
      { id: 4, amount: 0.2, currency: 'USD', type: 'expense', date: '2026-10-01' },
    ]
    expect(getTotals(txs, 'CRC')).toEqual({ count: 2, income: 1500, spent: 500.25, net: 999.75 })
    expect(getTotals(txs, 'USD')).toEqual({ count: 2, income: 10.1, spent: 0.2, net: 9.9 })
    expect(getTotals(txs, 'EUR')).toEqual({ count: 0, income: 0, spent: 0, net: 0 })
  })
  it('savings in/out per currency, separate', () => {
    const moves = [
      { id: 1, amount: 0.1, currency: 'USD', direction: 'in', date: '2026-10-01' },
      { id: 2, amount: 0.2, currency: 'USD', direction: 'in', date: '2026-10-01' },
      { id: 3, amount: 0.3, currency: 'USD', direction: 'out', date: '2026-10-01' },
      { id: 4, amount: 5000, currency: 'CRC', direction: 'in', date: '2026-10-01' },
      { id: 5, amount: 1500.5, currency: 'CRC', direction: 'out', date: '2026-10-01' },
    ]
    expect(savingsBalance(moves, 'USD')).toBe(0)
    expect(savingsBalance(moves, 'CRC')).toBe(3499.5)
    expect(savingsBalance([], 'CRC')).toBe(0)
  })
  it('safePerDay rounds down: colones whole, dollars cents', () => {
    expect(safePerDay(10000, 3, 'CRC')).toBe(3333)
    expect(safePerDay(100, 3, 'USD')).toBe(33.33)
    expect(safePerDay(0.01, 2, 'USD')).toBe(0)
    expect(safePerDay(1000, 1, 'CRC')).toBe(1000)
    expect(safePerDay(0.29, 1, 'USD')).toBe(0.29)
  })
})

describe('budgetPercent (floor rule)', () => {
  it('99.5% reads 99, exact 100% reads 100', () => {
    expect(budgetPercent(0.995)).toBe(99)
    expect(budgetPercent(0.999)).toBe(99)
    expect(budgetPercent(1)).toBe(100)
    expect(budgetPercent(0)).toBe(0)
    expect(budgetPercent(0.005)).toBe(0)
    expect(budgetPercent(1.5)).toBe(150)
  })
  it('n/100 reads n for every n in 0..500 (no float drop)', () => {
    for (let n = 0; n <= 500; n++) expect(budgetPercent(n / 100), `n=${n}`).toBe(n)
  })
  it('matches exact integer floor(100*spent/budget) for random cents (budgets up to 1e8 cents)', () => {
    const rand = mulberry32(QA_SEED)
    for (let i = 0; i < 20000; i++) {
      const budget = randInt(rand, 1, 100_000_000)
      const spent = randInt(rand, 0, budget * 2)
      const expected = Number((BigInt(spent) * 100n) / BigInt(budget))
      expect(budgetPercent(spent / 100 / (budget / 100)), `seed=${QA_SEED} spent=${spent} budget=${budget}`).toBe(expected)
    }
  })
  it('one cent short of a budget never reads 100% (realistic budget sizes)', () => {
    for (const budgetCents of [100, 1000, 10000, 100_000, 1_000_000, 10_000_000, 100_000_000, 500_000_000]) {
      const ratio = (budgetCents - 1) / 100 / (budgetCents / 100)
      expect(budgetPercent(ratio), `budget=${budgetCents} cents`).toBe(99)
    }
  })
  it('one cent short of a very large budget never reads 100% (budget up to MAX)', () => {
    for (const budgetCents of [1_000_000_000, 10_000_000_000, MAX_CENTS]) {
      const ratio = (budgetCents - 1) / 100 / (budgetCents / 100)
      expect(budgetPercent(ratio), `budget=${budgetCents} cents`).toBe(99)
    }
  })
})

describe('shareText', () => {
  it('rules: 0 for nothing, <1% for tiny, rounded otherwise', () => {
    expect(shareText(0, 100)).toBe('0%')
    expect(shareText(5, 0)).toBe('0%')
    expect(shareText(-5, 100)).toBe('0%')
    expect(shareText(NaN, 100)).toBe('0%')
    expect(shareText(1, 1000)).toBe('<1%')
    expect(shareText(4, 1000)).toBe('<1%')
    expect(shareText(10, 1000)).toBe('1%')
    expect(shareText(1, 3)).toBe('33%')
    expect(shareText(100, 100)).toBe('100%')
    expect(shareText(0.01, 1e9)).toBe('<1%')
  })
  it('matches exact half-up rounding of 100*part/whole for random cents', () => {
    const rand = mulberry32(QA_SEED)
    for (let i = 0; i < 20000; i++) {
      const whole = randInt(rand, 1, 1_000_000)
      const part = randInt(rand, 1, whole)
      // exact half-up percent: floor((200*part + whole) / (2*whole))
      const p = Number((200n * BigInt(part) + BigInt(whole)) / (2n * BigInt(whole)))
      const expected = p < 1 ? '<1%' : `${p}%`
      expect(shareText(part / 100, whole / 100), `seed=${QA_SEED} part=${part} whole=${whole}`).toBe(expected)
    }
  })
  it('exact half-up percent for every part/whole with whole <= 400 (float edge cases)', () => {
    const wrong = []
    for (let whole = 1; whole <= 400; whole++) {
      for (let part = 1; part <= whole; part++) {
        const p = Number((200n * BigInt(part) + BigInt(whole)) / (2n * BigInt(whole)))
        const expected = p < 1 ? '<1%' : `${p}%`
        if (shareText(part, whole) !== expected) wrong.push(`${part}/${whole}: got ${shareText(part, whole)} want ${expected}`)
      }
    }
    expect(wrong.slice(0, 10), `${wrong.length} mismatches`).toEqual([])
  })
  it('known half-way share 29/200 = 14.5% rounds up to 15%', () => {
    expect(shareText(29, 200)).toBe('15%')
    expect(shareText(0.29, 2)).toBe('15%')
  })
  it('shares of a split of N parts add to within N/2 of 100', () => {
    const rand = mulberry32(QA_SEED)
    for (let i = 0; i < 2000; i++) {
      const n = randInt(rand, 2, 8)
      const parts = Array.from({ length: n }, () => randInt(rand, 1, 100000))
      const whole = parts.reduce((a, b) => a + b, 0)
      // '<1%' is a share that rounds to 0, so it counts as 0
      const total = parts.reduce((s, p) => s + (parseInt(shareText(p, whole), 10) || 0), 0)
      expect(Math.abs(total - 100), `seed=${QA_SEED} parts=${parts}`).toBeLessThanOrEqual(n / 2)
    }
  })
})

describe('backup round trip keeps amounts exactly', () => {
  const tx = (id, amount, currency, extra = {}) => ({
    id, amount, currency, type: 'income', categoryId: null, note: '', date: '2026-10-01', paymentMethod: 'cash', ...extra,
  })
  it('buildBackup -> JSON -> inspectBackup, all boundaries, both currencies', () => {
    const amounts = [0.01, 0.1, 0.99, 1, 10.5, 99.99, 100, 999.99, 1000, 10000, 999999.99, MAX_AMOUNT]
    let id = 1
    const transactions = []
    for (const currency of ['CRC', 'USD']) {
      for (const amount of amounts) {
        transactions.push(tx(id++, amount, currency, id % 2 ? {} : { type: 'expense', categoryId: 1 }))
      }
    }
    const savings = amounts.map((amount, i) => ({ id: 100 + i, amount, currency: i % 2 ? 'USD' : 'CRC', direction: i % 3 ? 'in' : 'out', note: '', date: '2026-10-02' }))
    const budgets = [{ categoryId: 1, currency: 'CRC', amount: 123456.78 }, { categoryId: 2, currency: 'USD', amount: 0.01 }]
    const profile = { name: 'Ana', currency: 'CRC', income: 999999.99, savingsGoal: 0.01 }
    const backup = buildBackup({ transactions, categories: builtIn, budgets, recurring: [], savings, profile }, new Date('2026-10-12T00:00:00Z'))
    const result = inspectBackup(JSON.stringify(backup), builtIn)
    expect(result.ok).toBe(true)
    expect(result.droppedTotal).toBe(0)
    expect(result.data.transactions.map((t) => t.amount)).toEqual(transactions.map((t) => t.amount))
    expect(result.data.savings.map((t) => t.amount)).toEqual(savings.map((t) => t.amount))
    expect(result.data.budgets.map((t) => t.amount)).toEqual([123456.78, 0.01])
    expect(result.data.profile.income).toBe(999999.99)
    expect(result.data.profile.savingsGoal).toBe(0.01)
  })
  it('drops zero, negative, above-cap and non-number amounts without crashing', () => {
    const bad = [0, -1, MAX_AMOUNT + 0.01, '5', null, NaN, 0.004, 1e308]
    const transactions = bad.map((amount, i) => tx(i + 1, amount, 'CRC'))
    const backup = buildBackup({ transactions, categories: builtIn, budgets: [], recurring: [] })
    const result = inspectBackup(JSON.stringify(backup), builtIn)
    expect(result.ok).toBe(true)
    expect(result.data.transactions).toEqual([])
    expect(result.droppedTotal).toBe(bad.length)
  })
  it('float noise in a file (0.1+0.2) is cleaned to cents', () => {
    const result = inspectBackup(
      JSON.stringify(buildBackup({ transactions: [tx(1, 0.1 + 0.2, 'USD')], categories: builtIn, budgets: [], recurring: [] })),
      builtIn,
    )
    expect(result.data.transactions[0].amount).toBe(0.3)
  })
  it('random cent amounts survive the round trip exactly', () => {
    const rand = mulberry32(QA_SEED)
    const transactions = Array.from({ length: 2000 }, (_, i) =>
      tx(i + 1, randInt(rand, 1, MAX_CENTS) / 100, i % 2 ? 'USD' : 'CRC'),
    )
    const result = inspectBackup(
      JSON.stringify(buildBackup({ transactions, categories: builtIn, budgets: [], recurring: [] })),
      builtIn,
    )
    expect(result.data.transactions.map((t) => t.amount), `seed=${QA_SEED}`).toEqual(transactions.map((t) => t.amount))
  })
})

describe('CSV amounts', () => {
  const mk = (amount, currency = 'USD') => ({
    id: 1, amount, currency, type: 'expense', categoryId: 1, note: '', date: '2026-10-01', paymentMethod: 'cash',
  })
  // the amount cell may be a number (en) or a string (es); toCsv writes String(cell)
  const cell = (rows) => String(rows[1][2])
  it('Spanish: comma decimal; English: dot', () => {
    expect(cell(transactionRows([mk(1234.5)], builtIn, tr, 'es'))).toBe('1234,5')
    expect(cell(transactionRows([mk(1234.5)], builtIn, tr, 'en'))).toBe('1234.5')
    expect(cell(transactionRows([mk(0.01)], builtIn, tr, 'es'))).toBe('0,01')
    expect(cell(transactionRows([mk(1500, 'CRC')], builtIn, tr, 'es'))).toBe('1500')
  })
  it('every cent value 1..50000 prints without float noise in both languages', () => {
    for (let c = 1; c <= 50000; c++) {
      const en = plainCents(c)
      expect(cell(transactionRows([mk(c / 100)], builtIn, tr, 'en')), `cents ${c}`).toBe(en)
      expect(cell(transactionRows([mk(c / 100)], builtIn, tr, 'es')), `cents ${c}`).toBe(en.replace('.', ','))
    }
  })
  it('MAX_AMOUNT prints without exponent', () => {
    expect(cell(transactionRows([mk(MAX_AMOUNT)], builtIn, tr, 'en'))).toBe('1000000000')
  })
})
