// QA (Agent B): seeded randomized regression. Every expected figure is computed
// here with integer cents; the code under test only ever sees decimal amounts
// (cents / 100), like the app does after storage.js converts.
//
//   QA_SEED=123 QA_COUNT=2000 npx vitest run src/qa/seeded.qa.test.js
import { describe, expect, it } from 'vitest'
import { MAX_AMOUNT, MAX_CENTS, getTotals } from '../lib/money'
import { categories as builtIn } from '../db/mockData'
import { getCategoryTotals, getQuincenaHistory, getSpendingBars } from '../lib/stats'
import { buildReport } from '../lib/report'
import { quincenaFigures, rolloverLeftover } from '../lib/quincena'
import { savingsBalance } from '../lib/savings'
import { buildBackup, inspectBackup } from '../lib/backup'
import { transactionRows } from '../lib/csv'
import { QA_COUNT, QA_SEED, mulberry32, pick, randInt } from './seed'

const t = (k) => k
const CODES = ['CRC', 'USD']
const TODAY = new Date(2026, 9, 20) // 20 Oct 2026: quincena 16-31 Oct, 12 days left
const TODAY_TEXT = '2026-10-20'
const START_MS = Date.UTC(2026, 7, 1) // 1 Aug 2026
const DAYS = 92 // Aug 1 .. Oct 31

const dayText = (offset) => new Date(START_MS + offset * 86400000).toISOString().slice(0, 10)
const eq = (actual, cents, ctx) => {
  expect(Math.round(actual * 100), ctx).toBe(cents)
  expect(actual, `${ctx} (exact double)`).toBe(cents / 100)
}

const BOUNDARY = [1, 10, 99, 100, 1050, 9999, 10000, 99900, 100000, 1000000, 99999999, MAX_CENTS - 1, MAX_CENTS]
function randomCents(rand) {
  const r = rand()
  if (r < 0.25) return randInt(rand, 1, 99) // small
  if (r < 0.8) return randInt(rand, 100, 5_000_000) // ordinary
  if (r < 0.92) return randInt(rand, 5_000_000, 5_000_000_000) // large
  return pick(rand, BOUNDARY)
}

function generate(seed, count) {
  const rand = mulberry32(seed)
  let id = 1
  const txs = []
  for (let i = 0; i < count; i++) {
    const type = rand() < 0.3 ? 'income' : 'expense'
    let categoryId = null
    if (type === 'expense') {
      const r = rand()
      categoryId = r < 0.06 ? 99 : r < 0.1 ? null : pick(rand, builtIn).id // 99 = unknown category
    }
    txs.push({
      id: id++,
      cents: randomCents(rand),
      currency: pick(rand, CODES),
      type,
      categoryId,
      note: '',
      date: dayText(randInt(rand, 0, DAYS - 1)),
      paymentMethod: 'cash',
    })
  }
  const moves = []
  for (let i = 0; i < Math.max(5, Math.floor(count / 10)); i++) {
    moves.push({
      id: id++,
      cents: randomCents(rand) % 50_000_000 || 1,
      currency: pick(rand, CODES),
      direction: rand() < 0.6 ? 'in' : 'out',
      note: '',
      date: dayText(randInt(rand, 0, DAYS - 1)),
    })
  }
  return { txs, moves }
}

// what the app sees
const asApp = (list) => list.map(({ cents, ...rest }) => ({ ...rest, amount: cents / 100 }))

// independent integer helpers
const inRange = (item, a, b) => item.date >= a && item.date <= b
function totalsCents(txs, code, a = '0000-00-00', b = '9999-99-99') {
  let income = 0
  let spent = 0
  let count = 0
  for (const x of txs) {
    if (x.currency !== code || !inRange(x, a, b)) continue
    count++
    if (x.type === 'income') income += x.cents
    else spent += x.cents
  }
  return { count, income, spent, net: income - spent }
}
function movesCents(moves, code, a = '0000-00-00', b = '9999-99-99') {
  let toSavings = 0
  let fromSavings = 0
  for (const m of moves) {
    if (m.currency !== code || !inRange(m, a, b)) continue
    if (m.direction === 'in') toSavings += m.cents
    else fromSavings += m.cents
  }
  return { toSavings, fromSavings }
}
// exact half-up tenth of a percent, as an integer (BigInt, no floats)
const tenthsHalfUp = (part, whole) =>
  Number((2000n * BigInt(part) + BigInt(whole)) / (2n * BigInt(whole)))

const SEEDS = [QA_SEED, QA_SEED + 1, QA_SEED + 2]

describe.each(SEEDS)('seeded regression (seed=%i)', (seed) => {
  const { txs, moves } = generate(seed, QA_COUNT)
  const appTxs = asApp(txs)
  const appMoves = asApp(moves)
  const ctx = (extra) => `seed=${seed} count=${QA_COUNT} ${extra}`

  it('generated amounts are all valid app amounts', () => {
    for (const x of txs) {
      expect(x.cents >= 1 && x.cents <= MAX_CENTS, ctx(`id=${x.id}`)).toBe(true)
      expect(x.cents / 100 <= MAX_AMOUNT).toBe(true)
    }
  })

  it('getTotals per currency equals integer-cent income / spent / net', () => {
    for (const code of CODES) {
      const exp = totalsCents(txs, code)
      const got = getTotals(appTxs, code)
      expect(got.count, ctx(code)).toBe(exp.count)
      eq(got.income, exp.income, ctx(`${code} income`))
      eq(got.spent, exp.spent, ctx(`${code} spent`))
      eq(got.net, exp.net, ctx(`${code} net`))
    }
  })

  it('currencies never mix: totals change only when that currency changes', () => {
    const onlyCrc = appTxs.filter((x) => x.currency === 'CRC')
    expect(getTotals(onlyCrc, 'CRC')).toEqual(getTotals(appTxs, 'CRC'))
    expect(getTotals(onlyCrc, 'USD')).toEqual({ count: 0, income: 0, spent: 0, net: 0 })
  })

  it('getCategoryTotals per category (and Uncategorized) matches', () => {
    for (const code of CODES) {
      const expenses = appTxs.filter((x) => x.type === 'expense' && x.currency === code)
      const got = getCategoryTotals(expenses, builtIn)
      const expectedByCat = new Map()
      let uncategorized = 0
      for (const x of txs) {
        if (x.type !== 'expense' || x.currency !== code) continue
        if (builtIn.some((c) => c.id === x.categoryId)) {
          expectedByCat.set(x.categoryId, (expectedByCat.get(x.categoryId) ?? 0) + x.cents)
        } else uncategorized += x.cents
      }
      for (const row of got) {
        const want = row.category.id === 0 ? uncategorized : expectedByCat.get(row.category.id)
        eq(row.total, want, ctx(`${code} category ${row.category.id}`))
      }
      const expectedRows = expectedByCat.size + (uncategorized > 0 ? 1 : 0)
      expect(got.length, ctx(`${code} rows`)).toBe(expectedRows)
      // categories + uncategorized add up to total spent
      const spent = totalsCents(txs, code).spent
      const rowsSum = [...expectedByCat.values()].reduce((a, b) => a + b, 0) + uncategorized
      expect(rowsSum, ctx(`${code} rows sum`)).toBe(spent)
    }
  })

  it('savings balance per currency', () => {
    for (const code of CODES) {
      const m = movesCents(moves, code)
      eq(savingsBalance(appMoves, code), m.toSavings - m.fromSavings, ctx(`${code} savings`))
    }
  })

  it('monthly spending bars (6 months) and weekly bars (7 days)', () => {
    for (const code of CODES) {
      const months = [
        ['2026-05', 0], ['2026-06', 0], ['2026-07', 0],
        ['2026-08', 0], ['2026-09', 0], ['2026-10', 0],
      ]
      for (const x of txs) {
        if (x.type !== 'expense' || x.currency !== code) continue
        const m = months.find(([k]) => x.date.startsWith(k))
        if (m) m[1] += x.cents
      }
      const bars = getSpendingBars(appTxs, code, 'month', TODAY)
      expect(bars.length).toBe(6)
      bars.forEach((bar, i) => eq(bar.total, months[i][1], ctx(`${code} month ${months[i][0]}`)))

      const week = getSpendingBars(appTxs, code, 'week', TODAY)
      week.forEach((bar, i) => {
        const date = dayText((Date.UTC(2026, 9, 20) - START_MS) / 86400000 - (6 - i))
        const want = txs
          .filter((x) => x.type === 'expense' && x.currency === code && x.date === date)
          .reduce((a, x) => a + x.cents, 0)
        eq(bar.total, want, ctx(`${code} day ${date}`))
      })
      const years = getSpendingBars(appTxs, code, 'year', TODAY)
      const y2026 = txs.filter((x) => x.type === 'expense' && x.currency === code).reduce((a, x) => a + x.cents, 0)
      eq(years[2].total, y2026, ctx(`${code} year 2026`))
    }
  })

  it('quincena history: income, spent and net (with savings) per half-month', () => {
    const halves = [
      ['2026-10-16', '2026-10-31'], ['2026-10-01', '2026-10-15'],
      ['2026-09-16', '2026-09-30'], ['2026-09-01', '2026-09-15'],
      ['2026-08-16', '2026-08-31'], ['2026-08-01', '2026-08-15'],
    ]
    for (const code of CODES) {
      const history = getQuincenaHistory(appTxs, code, 6, TODAY, appMoves)
      history.forEach((q, i) => {
        const [a, b] = halves[i]
        const tc = totalsCents(txs, code, a, b)
        const mc = movesCents(moves, code, a, b)
        eq(q.income, tc.income, ctx(`${code} ${a} income`))
        eq(q.spent, tc.spent, ctx(`${code} ${a} spent`))
        eq(q.net, tc.net - mc.toSavings + mc.fromSavings, ctx(`${code} ${a} net`))
      })
    }
  })

  it('quincenaFigures (current quincena) and rolloverLeftover', () => {
    const a = '2026-10-16'
    const b = '2026-10-31'
    for (const code of CODES) {
      const fig = quincenaFigures(
        { transactions: appTxs, savings: appMoves, recurring: [] },
        code,
        TODAY,
      )
      const tc = totalsCents(txs, code, a, b)
      const mc = movesCents(moves, code, a, b)
      const left = tc.net - mc.toSavings + mc.fromSavings
      const laterIncome = txs
        .filter((x) => x.currency === code && x.type === 'income' && inRange(x, a, b) && x.date > TODAY_TEXT)
        .reduce((s, x) => s + x.cents, 0)
      const later = txs
        .filter((x) => x.currency === code && x.type === 'expense' && inRange(x, a, b) && x.date > TODAY_TEXT)
        .reduce((s, x) => s + x.cents, 0)
      const inHand = left - laterIncome
      eq(fig.income, tc.income, ctx(`${code} fig income`))
      eq(fig.spent, tc.spent, ctx(`${code} fig spent`))
      eq(fig.net, tc.net, ctx(`${code} fig net`))
      eq(fig.toSavings, mc.toSavings, ctx(`${code} fig toSavings`))
      eq(fig.fromSavings, mc.fromSavings, ctx(`${code} fig fromSavings`))
      eq(fig.left, left, ctx(`${code} fig left`))
      eq(fig.later, later, ctx(`${code} fig later`))
      eq(fig.laterIncome, laterIncome, ctx(`${code} fig laterIncome`))
      eq(fig.inHand, inHand, ctx(`${code} fig inHand`))
      eq(fig.available, inHand, ctx(`${code} fig available`))
      expect(fig.days).toBe(12)
      const status = inHand > 0 ? 'ok' : left > 0 ? 'waitingIncome' : 'over'
      expect(fig.status, ctx(`${code} status`)).toBe(status)
      if (status === 'ok') {
        const perDayCents = Math.floor(inHand / 12)
        eq(fig.perDay, code === 'USD' ? perDayCents : Math.floor(perDayCents / 100) * 100, ctx(`${code} perDay`))
      } else {
        expect(fig.perDay).toBe(0)
      }

      // rollover: previous quincena (1-15 Oct), minus income dated on its closing day
      const pt = totalsCents(txs, code, '2026-10-01', '2026-10-15')
      const pm = movesCents(moves, code, '2026-10-01', '2026-10-15')
      const closingIncome = txs
        .filter((x) => x.currency === code && x.type === 'income' && x.date === '2026-10-15')
        .reduce((s, x) => s + x.cents, 0)
      eq(
        rolloverLeftover({ transactions: appTxs, savings: appMoves }, code, TODAY),
        pt.net - pm.toSavings + pm.fromSavings - closingIncome,
        ctx(`${code} rollover`),
      )
    }
  })

  it('buildReport (all months): totals, category rows, shares, day items', () => {
    const { sections } = buildReport({ transactions: appTxs, savings: appMoves, categories: builtIn, t })
    const months = [...new Set(txs.map((x) => x.date.slice(0, 7)).concat(moves.map((m) => m.date.slice(0, 7))))]
      .sort()
      .reverse()
    expect(sections.map((s) => s.key), ctx('months')).toEqual(months)
    for (const section of sections) {
      const a = `${section.key}-01`
      const b = `${section.key}-31`
      for (const code of CODES) {
        const tc = totalsCents(txs, code, a, b)
        const mc = movesCents(moves, code, a, b)
        const has = tc.count > 0 || moves.some((m) => m.currency === code && inRange(m, a, b))
        const entry = section.totals.find((x) => x.code === code)
        expect(Boolean(entry), ctx(`${section.key} ${code} present`)).toBe(has)
        if (!entry) continue
        eq(entry.income, tc.income, ctx(`${section.key} ${code} income`))
        eq(entry.spent, tc.spent, ctx(`${section.key} ${code} spent`))
        eq(entry.savedIn, mc.toSavings, ctx(`${section.key} ${code} savedIn`))
        eq(entry.savedOut, mc.fromSavings, ctx(`${section.key} ${code} savedOut`))

        // categories
        const block = section.categories.find((x) => x.code === code)
        const spentRows = txs.filter((x) => x.type === 'expense' && x.currency === code && inRange(x, a, b))
        expect(Boolean(block), ctx(`${section.key} ${code} has cat block`)).toBe(spentRows.length > 0)
        if (!block) continue
        eq(block.spent, tc.spent, ctx(`${section.key} ${code} block spent`))
        let rowsSum = 0
        let prev = Infinity
        for (const row of block.rows) {
          const want = spentRows
            .filter((x) => (row.category.id === 0 ? !builtIn.some((c) => c.id === x.categoryId) : x.categoryId === row.category.id))
            .reduce((s, x) => s + x.cents, 0)
          eq(row.amount, want, ctx(`${section.key} ${code} cat ${row.category.id}`))
          expect(Math.round(row.amount * 100) <= prev, ctx('sorted biggest first')).toBe(true)
          prev = Math.round(row.amount * 100)
          rowsSum += want
          // one-decimal share, exact half-up
          expect(row.share * 10, ctx(`${section.key} ${code} share cat ${row.category.id} (${want}/${tc.spent})`)).toBe(
            tenthsHalfUp(want, tc.spent),
          )
        }
        expect(rowsSum, ctx(`${section.key} ${code} rows add up`)).toBe(tc.spent)
      }

      // day items: signed amounts add up to income - spent per currency
      for (const code of CODES) {
        const items = section.days.flatMap((d) => d.items).filter((i) => i.currency === code)
        const signed = items.reduce((s, i) => s + Math.round(i.amount * 100), 0)
        const tc = totalsCents(txs, code, a, b)
        expect(signed, ctx(`${section.key} ${code} day items net`)).toBe(tc.net)
      }
      const dates = section.days.map((d) => d.date)
      expect(dates, ctx('days newest first')).toEqual([...dates].sort().reverse())
    }
  })

  it('buildReport month scope equals the same section of the all-scope; list scope sums ids', () => {
    const all = buildReport({ transactions: appTxs, savings: appMoves, categories: builtIn, t }).sections
    const oct = buildReport({ transactions: appTxs, savings: appMoves, categories: builtIn, scope: { kind: 'month', year: 2026, month: 9 }, t })
    expect(oct.sections.length).toBe(1)
    expect(oct.sections[0]).toEqual(all.find((s) => s.key === '2026-10'))

    const ids = txs.filter((x, i) => i % 3 === 0).map((x) => x.id)
    const list = buildReport({ transactions: appTxs, savings: appMoves, categories: builtIn, scope: { kind: 'list', ids }, t }).sections
    const subset = txs.filter((x) => ids.includes(x.id))
    for (const code of CODES) {
      const tc = totalsCents(subset, code)
      const entry = list[0]?.totals.find((x) => x.code === code)
      if (tc.count === 0) {
        expect(entry).toBeUndefined()
        continue
      }
      eq(entry.income, tc.income, ctx(`list ${code} income`))
      eq(entry.spent, tc.spent, ctx(`list ${code} spent`))
      expect(entry.savedIn).toBe(0)
    }
  })

  it('backup round trip keeps every amount and the totals', () => {
    const backup = buildBackup({
      transactions: appTxs.map(({ ...x }) => x),
      categories: builtIn,
      budgets: [],
      recurring: [],
      savings: appMoves,
    })
    const result = inspectBackup(JSON.stringify(backup), builtIn)
    expect(result.ok, ctx('backup ok')).toBe(true)
    // category 99 does not exist: the expense is kept but loses its category
    expect(result.data.transactions.length, ctx('tx kept')).toBe(txs.length)
    expect(result.data.savings.length).toBe(moves.length)
    result.data.transactions.forEach((x, i) => {
      expect(Math.round(x.amount * 100), ctx(`tx ${x.id}`)).toBe(txs[i].cents)
    })
    for (const code of CODES) {
      eq(getTotals(result.data.transactions, code).net, totalsCents(txs, code).net, ctx(`restored ${code} net`))
    }
  })

  it('CSV rows carry the exact amount in both languages', () => {
    for (const lang of ['en', 'es']) {
      const rows = transactionRows(appTxs, builtIn, t, lang).slice(1)
      rows.forEach((row, i) => {
        const text = String(row[2])
        const c = txs[i].cents
        const intPart = Math.floor(c / 100)
        const frac = String(c % 100).padStart(2, '0').replace(/0+$/, '')
        const plain = frac ? `${intPart}.${frac}` : `${intPart}`
        expect(text, ctx(`csv ${lang} tx ${txs[i].id}`)).toBe(lang === 'es' ? plain.replace('.', ',') : plain)
        expect(row[3]).toBe(txs[i].currency)
      })
    }
  })
})
