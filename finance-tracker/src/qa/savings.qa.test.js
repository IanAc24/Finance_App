import { describe, expect, it } from 'vitest'
import { buildReport } from '../lib/report'
import { getTotals } from '../lib/money'
import { getQuincenaHistory } from '../lib/stats'
import { quincenaFigures } from '../lib/quincena'
import { incomeSummary } from '../lib/income'
import { savingsBalance, savingsBalanceCents, canWithdraw } from '../lib/savings'
import { savingsYear, yearRecap, periodSurplus, availableYears } from '../lib/savingsReport'
import { goalsReached, planSavingsMove } from '../lib/goals'
import { nextGoal, goalProgress, pigFill } from '../lib/savingsUi'
import { QA_SEED, mulberry32 } from './seed'

// Independent QA checks. Expectations are written as INTEGER CENTS by hand or
// by a tiny reference model below, never by calling the code under test.

const SEED = QA_SEED
const rng = mulberry32

const tx = (id, type, amount, date, currency = 'CRC') => ({
  id,
  type,
  amount,
  date,
  currency,
  categoryId: type === 'expense' ? 'food' : null,
  note: '',
})
const mv = (id, direction, amount, date, currency = 'CRC') => ({
  id,
  direction,
  amount,
  date,
  currency,
  note: '',
})
const t = (key) => key
const categories = [{ id: 'food', name: 'Food', builtin: true }]

describe('savings are never income or expense', () => {
  const txs = [
    tx(1, 'income', 100000, '2026-03-05'),
    tx(2, 'expense', 25000.5, '2026-03-06'),
    tx(3, 'income', 50, '2026-03-07', 'USD'),
  ]
  const moves = [
    mv(10, 'in', 40000, '2026-03-08'),
    mv(11, 'out', 5000, '2026-03-09'),
    mv(12, 'in', 20, '2026-03-08', 'USD'),
  ]

  it('getTotals ignores moves by construction (only transactions are passed)', () => {
    const totals = getTotals(txs, 'CRC')
    expect(Math.round(totals.income * 100)).toBe(10000000)
    expect(Math.round(totals.spent * 100)).toBe(2500050)
  })

  it('report income/spent do not change when savings exist; saved are separate', () => {
    const withMoves = buildReport({ transactions: txs, savings: moves, categories, t })
    const without = buildReport({ transactions: txs, savings: [], categories, t })
    const a = withMoves.sections[0].totals.find((x) => x.code === 'CRC')
    const b = without.sections[0].totals.find((x) => x.code === 'CRC')
    expect(Math.round(a.income * 100)).toBe(10000000)
    expect(Math.round(a.spent * 100)).toBe(2500050)
    expect(a.income).toBe(b.income)
    expect(a.spent).toBe(b.spent)
    expect(Math.round(a.savedIn * 100)).toBe(4000000)
    expect(Math.round(a.savedOut * 100)).toBe(500000)
  })

  it('quincena income/spent are unchanged by savings', () => {
    const today = new Date(2026, 2, 10)
    const f = quincenaFigures({ transactions: txs, savings: moves, recurring: [] }, 'CRC', today)
    const g = quincenaFigures({ transactions: txs, savings: [], recurring: [] }, 'CRC', today)
    expect(f.income).toBe(g.income)
    expect(f.spent).toBe(g.spent)
    expect(Math.round(f.toSavings * 100)).toBe(4000000)
  })

  it('quincena history keeps income/spent, only net moves', () => {
    const today = new Date(2026, 2, 10)
    const [h] = getQuincenaHistory(txs, 'CRC', 1, today, moves)
    const [h0] = getQuincenaHistory(txs, 'CRC', 1, today, [])
    expect(h.income).toBe(h0.income)
    expect(h.spent).toBe(h0.spent)
  })

  it('incomeSummary counts only incomes, per currency', () => {
    const s = incomeSummary(txs, { from: '2026-01-01', to: '2026-12-31' })
    expect(s.CRC.totalCents).toBe(10000000)
    expect(s.USD.totalCents).toBe(5000)
  })

  it('yearRecap keeps surplus apart from savings; surplus is never added to closing', () => {
    const r = yearRecap(txs, moves, [], 2026)
    expect(Math.round(r.CRC.income * 100)).toBe(10000000)
    expect(Math.round(r.CRC.expenses * 100)).toBe(2500050)
    // surplus = 100000 - 25000.50 = 74999.50 -> 7499950 cents
    expect(Math.round(r.CRC.surplus * 100)).toBe(7499950)
    // closing = 40000 - 5000 = 35000 -> 3500000 cents, not influenced by surplus
    expect(Math.round(r.CRC.closing * 100)).toBe(3500000)
    expect(Math.round(r.USD.closing * 100)).toBe(2000)
  })

  it('periodSurplus is income minus expenses only, in cents', () => {
    expect(Math.round(periodSurplus(txs, '2026-03-01', '2026-03-31', 'CRC') * 100)).toBe(7499950)
    expect(Math.round(periodSurplus(txs, '2026-03-01', '2026-03-31', 'USD') * 100)).toBe(5000)
  })
})

describe('year boundaries', () => {
  const moves = [
    mv(1, 'in', 1000.1, '2024-12-31'),
    mv(2, 'in', 500.2, '2025-01-01'),
    mv(3, 'out', 200.3, '2025-12-31'),
    mv(4, 'in', 0.01, '2026-01-01'),
    mv(5, 'in', 77, '2025-06-01', 'USD'),
    mv(6, 'out', 7, '2026-01-01', 'USD'),
  ]
  it('Dec 31 belongs to its year, Jan 1 to the next', () => {
    const y24 = savingsYear(moves, 2024, 'CRC')
    expect([y24.opening, y24.deposits, y24.withdrawals, y24.closing]).toEqual([0, 1000.1, 0, 1000.1])
    const y25 = savingsYear(moves, 2025, 'CRC')
    expect(Math.round(y25.opening * 100)).toBe(100010)
    expect(Math.round(y25.deposits * 100)).toBe(50020)
    expect(Math.round(y25.withdrawals * 100)).toBe(20030)
    expect(Math.round(y25.closing * 100)).toBe(130000)
    const y26 = savingsYear(moves, 2026, 'CRC')
    expect(Math.round(y26.opening * 100)).toBe(130000)
    expect(Math.round(y26.closing * 100)).toBe(130001)
  })
  it('currencies never mix', () => {
    expect(savingsYear(moves, 2025, 'USD').closing).toBe(77)
    expect(savingsYear(moves, 2026, 'USD').opening).toBe(77)
    expect(savingsYear(moves, 2026, 'USD').closing).toBe(70)
    expect(savingsBalanceCents(moves, 'CRC')).toBe(130001)
    expect(savingsBalanceCents(moves, 'USD')).toBe(7000)
  })
  it('a year with no moves still carries the opening (no reset)', () => {
    const y = savingsYear([mv(1, 'in', 10, '2023-05-05')], 2026, 'CRC')
    expect([y.opening, y.deposits, y.withdrawals, y.closing]).toEqual([10, 0, 0, 10])
  })
  it('availableYears lists years of transactions, moves and achieved goals', () => {
    const years = availableYears(
      [tx(1, 'income', 1, '2022-01-01')],
      [mv(1, 'in', 1, '2024-01-01')],
      [{ achievedAt: '2025-02-02' }, { achievedAt: null }],
    )
    expect(years).toEqual([2025, 2024, 2022])
  })
})

describe('goals', () => {
  const goal = (over = {}) => ({
    id: 1,
    name: 'g',
    target: 1000.1,
    currency: 'CRC',
    createdAt: '2026-01-01',
    achievedAt: null,
    ...over,
  })
  it('met exactly at target, not one cent below', () => {
    expect(goalsReached([goal()], [mv(1, 'in', 1000.09, '2026-02-02')], 'CRC')).toHaveLength(0)
    expect(goalsReached([goal()], [mv(1, 'in', 1000.1, '2026-02-02')], 'CRC')).toHaveLength(1)
    // float trap: 0.1 + 0.2 style accumulation
    const parts = [mv(1, 'in', 500.05, '2026-02-02'), mv(2, 'in', 500.05, '2026-02-03')]
    expect(goalsReached([goal()], parts, 'CRC')).toHaveLength(1)
  })
  it('plan: deposit that reaches the goal marks it, withdrawal never does', () => {
    const saved = [mv(1, 'in', 900, '2026-02-01')]
    const plan = planSavingsMove(mv(2, 'in', 100.1, '2026-02-02'), saved, [goal()])
    expect(plan).toEqual({ ok: true, achieveGoalIds: [1] })
    const low = planSavingsMove(mv(3, 'in', 100.09, '2026-02-02'), saved, [goal()])
    expect(low.achieveGoalIds).toEqual([])
    const out = planSavingsMove(mv(4, 'out', 1, '2026-02-02'), saved, [goal()])
    expect(out).toEqual({ ok: true, achieveGoalIds: [] })
  })
  it('achieved goal stays achieved after a withdrawal; is not reached twice', () => {
    const done = goal({ achievedAt: '2026-02-02' })
    const saved = [mv(1, 'in', 1000.1, '2026-02-02'), mv(2, 'out', 900, '2026-02-03')]
    expect(goalsReached([done], saved, 'CRC')).toHaveLength(0)
    // topping back up never re-celebrates
    const plan = planSavingsMove(mv(3, 'in', 5000, '2026-02-04'), saved, [done])
    expect(plan.achieveGoalIds).toEqual([])
    expect(goalProgress(done, 100.1).percent).toBe(100)
    expect(nextGoal([done], 'CRC')).toBeNull()
  })
  it('goal of the other currency is not reached by this balance', () => {
    expect(goalsReached([goal({ currency: 'USD', target: 5 })], [mv(1, 'in', 99999, '2026-01-01')], 'USD')).toHaveLength(0)
  })
  it('retry of the same id does not count the earlier try twice', () => {
    const first = mv(9, 'in', 600, '2026-02-02')
    const saved = [mv(1, 'in', 500, '2026-02-01'), first]
    // 500 + 600 = 1100 >= 1000.1 but the retry of #9 replaces it: still 1100
    expect(planSavingsMove(first, saved, [goal({ target: 1100.01 })]).achieveGoalIds).toEqual([])
    expect(planSavingsMove(first, saved, [goal({ target: 1100 })]).achieveGoalIds).toEqual([1])
  })
  it('percent is 99 one cent below, 100 at target; fill monotonic', () => {
    expect(goalProgress(goal({ target: 100 }), 99.99).percent).toBe(99)
    expect(goalProgress(goal({ target: 100 }), 100).percent).toBe(100)
    expect(pigFill(0, goal())).toBe(0)
    expect(pigFill(100000, goal())).toBe(1)
  })
})

describe('withdrawals', () => {
  it('above balance refused, exactly balance allowed, by cents', () => {
    const saved = [mv(1, 'in', 10.1, '2026-01-01'), mv(2, 'in', 0.2, '2026-01-02')]
    expect(canWithdraw(saved, 'CRC', 10.3)).toBe(true)
    expect(canWithdraw(saved, 'CRC', 10.31)).toBe(false)
    expect(canWithdraw(saved, 'USD', 0.01)).toBe(false)
    expect(planSavingsMove(mv(3, 'out', 10.31, '2026-01-03'), saved, [])).toEqual({
      ok: false,
      code: 'insufficientSavings',
    })
  })
})

describe('seeded random sequence', () => {
  it(`balance = sum, never negative, yearly closings chain (seed ${SEED})`, () => {
    const r = rng(SEED)
    const moves = []
    const model = { CRC: 0, USD: 0 }
    let id = 1
    for (let i = 0; i < 600; i++) {
      const currency = r() < 0.5 ? 'CRC' : 'USD'
      const year = 2023 + Math.floor(r() * 4) // 2023..2026
      const month = 1 + Math.floor(r() * 12)
      const day = r() < 0.2 ? (month === 12 ? 31 : 1) : 1 + Math.floor(r() * 28)
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      // chronology doesn't matter for the app's balance rule (total), only total
      const wantsOut = r() < 0.45
      const cents = 1 + Math.floor(r() * 500000)
      if (wantsOut) {
        const move = mv(id, 'out', cents / 100, date, currency)
        if (cents > model[currency]) {
          expect(canWithdraw(moves, currency, move.amount)).toBe(false)
          expect(planSavingsMove(move, moves, []).ok).toBe(false)
          continue
        }
        expect(planSavingsMove(move, moves, []).ok).toBe(true)
        model[currency] -= cents
        moves.push(move)
      } else {
        model[currency] += cents
        moves.push(mv(id, 'in', cents / 100, date, currency))
      }
      id++
      expect(model[currency]).toBeGreaterThanOrEqual(0)
    }
    for (const c of ['CRC', 'USD']) {
      expect(savingsBalanceCents(moves, c)).toBe(model[c])
      expect(Math.round(savingsBalance(moves, c) * 100)).toBe(model[c])
      let prevClosing = 0
      let totalDep = 0
      let totalOut = 0
      for (const year of [2023, 2024, 2025, 2026]) {
        const y = savingsYear(moves, year, c)
        expect(Math.round(y.opening * 100)).toBe(prevClosing)
        expect(Math.round(y.closing * 100)).toBe(
          Math.round(y.opening * 100) + Math.round(y.deposits * 100) - Math.round(y.withdrawals * 100),
        )
        prevClosing = Math.round(y.closing * 100)
        totalDep += Math.round(y.deposits * 100)
        totalOut += Math.round(y.withdrawals * 100)
      }
      expect(prevClosing).toBe(model[c])
      expect(totalDep - totalOut).toBe(model[c])
    }
  })

  it('note: yearly closing of a past year can be negative when moves are out of date order', () => {
    // A withdrawal dated in 2024 funded by a deposit dated 2025 (backdated entry)
    const moves = [mv(1, 'in', 100, '2025-01-01'), mv(2, 'out', 50, '2024-06-01')]
    // the app only checks the TOTAL balance, so this is accepted
    expect(canWithdraw([mv(1, 'in', 100, '2025-01-01')], 'CRC', 50)).toBe(true)
    expect(savingsYear(moves, 2024, 'CRC').closing).toBe(-50)
  })
})
