import { describe, expect, it } from 'vitest'
import { goalsReached, normalizeGoal, planSavingsMove } from './goals'

const goal = (changes = {}) => ({
  id: 1,
  name: 'Trip',
  target: 100000,
  currency: 'CRC',
  createdAt: '2026-01-01',
  achievedAt: null,
  ...changes,
})
const move = (changes = {}) => ({
  id: 10,
  amount: 60000,
  currency: 'CRC',
  direction: 'in',
  note: '',
  date: '2026-10-01',
  ...changes,
})

describe('normalizeGoal', () => {
  it('trims and cuts the name to 40, rounds the target to cents', () => {
    const clean = normalizeGoal(
      { name: `  ${'x'.repeat(50)}  `, target: 10.005, currency: 'USD' },
      '2026-10-24',
    )
    expect(clean.name).toBe('x'.repeat(40))
    expect(clean.target).toBe(10.01)
    expect(clean.createdAt).toBe('2026-10-24')
    expect(clean.achievedAt).toBeNull()
    expect('id' in clean).toBe(false)
  })

  it('keeps an id and valid dates, and drops invalid dates', () => {
    expect(normalizeGoal(goal({ achievedAt: '2026-05-05' }))).toEqual(
      goal({ achievedAt: '2026-05-05' }),
    )
    const clean = normalizeGoal(goal({ createdAt: 'ayer', achievedAt: '2026-02-31' }), '2026-10-24')
    expect(clean.createdAt).toBe('2026-10-24')
    expect(clean.achievedAt).toBeNull()
  })

  it('rejects an empty name, a bad target and an unknown currency', () => {
    expect(() => normalizeGoal(goal({ name: '   ' }))).toThrow()
    expect(() => normalizeGoal(goal({ name: 5 }))).toThrow()
    expect(() => normalizeGoal(goal({ target: 0 }))).toThrow()
    expect(() => normalizeGoal(goal({ target: -5 }))).toThrow()
    expect(() => normalizeGoal(goal({ target: 1_000_000_001 }))).toThrow()
    expect(() => normalizeGoal(goal({ target: NaN }))).toThrow()
    expect(() => normalizeGoal(goal({ currency: 'EUR' }))).toThrow()
  })
})

describe('goalsReached', () => {
  it('returns the unachieved goals of the currency met by its balance', () => {
    const goals = [
      goal({ id: 1, target: 50000 }),
      goal({ id: 2, target: 60000 }),
      goal({ id: 3, target: 60001 }),
      goal({ id: 4, target: 10, currency: 'USD' }),
    ]
    const reached = goalsReached(goals, [move()], 'CRC')
    expect(reached.map((g) => g.id)).toEqual([1, 2])
  })

  it('does not return a goal already achieved', () => {
    const goals = [goal({ id: 1, target: 100, achievedAt: '2026-09-01' }), goal({ id: 2, target: 100 })]
    expect(goalsReached(goals, [move()], 'CRC').map((g) => g.id)).toEqual([2])
  })

  it('never mixes currencies', () => {
    const savings = [move({ currency: 'USD', amount: 1000000 })]
    expect(goalsReached([goal({ target: 1 })], savings, 'CRC')).toEqual([])
    expect(goalsReached([goal({ target: 1, currency: 'USD' })], savings, 'USD')).toHaveLength(1)
  })

  it('counts withdrawals and compares in whole cents', () => {
    const savings = [move({ amount: 0.1 }), move({ id: 11, amount: 0.2 })]
    expect(goalsReached([goal({ target: 0.3 })], savings, 'CRC')).toHaveLength(1)
    const lessed = [move({ amount: 100000 }), move({ id: 11, direction: 'out', amount: 1 })]
    expect(goalsReached([goal({ target: 100000 })], lessed, 'CRC')).toEqual([])
  })

  it('does not clear achievedAt when a withdrawal drops the balance (it only reads)', () => {
    const achieved = goal({ achievedAt: '2026-09-01' })
    const savings = [move({ amount: 100000 }), move({ id: 11, direction: 'out', amount: 90000 })]
    expect(goalsReached([achieved], savings, 'CRC')).toEqual([])
    expect(achieved.achievedAt).toBe('2026-09-01')
  })
})

describe('planSavingsMove', () => {
  it('rejects a withdrawal larger than the balance of its currency', () => {
    const savings = [move({ amount: 5000 }), move({ id: 11, currency: 'USD', amount: 900 })]
    const out = (amount, currency = 'CRC') => move({ id: 99, direction: 'out', amount, currency })
    expect(planSavingsMove(out(5000.01), savings, [])).toEqual({
      ok: false,
      code: 'insufficientSavings',
    })
    expect(planSavingsMove(out(5000), savings, []).ok).toBe(true)
    // the dollars cannot cover colones
    expect(planSavingsMove(out(6000), savings, []).ok).toBe(false)
    expect(planSavingsMove(out(900, 'USD'), savings, []).ok).toBe(true)
  })

  it('says which goals a deposit reaches, and none for a withdrawal', () => {
    const goals = [goal({ id: 1, target: 100000 }), goal({ id: 2, target: 200000 })]
    const savings = [move({ amount: 50000 })]
    expect(
      planSavingsMove(move({ id: 99, amount: 60000 }), savings, goals),
    ).toEqual({ ok: true, achieveGoalIds: [1] })
    expect(
      planSavingsMove(move({ id: 99, direction: 'out', amount: 100 }), savings, goals),
    ).toEqual({ ok: true, achieveGoalIds: [] })
  })

  it('does not count a retry of the same move twice', () => {
    const goals = [goal({ id: 1, target: 100000 })]
    const first = move({ id: 99, amount: 60000 })
    const savings = [move({ amount: 50000 }), first]
    // the first try is already in the state: still 110000, not 170000
    expect(planSavingsMove(first, savings, goals).achieveGoalIds).toEqual([1])
    const smaller = [move({ amount: 20000 }), first]
    expect(planSavingsMove(first, smaller, [goal({ target: 90000 })]).achieveGoalIds).toEqual([])
    // and a retried withdrawal is not subtracted twice
    const out = move({ id: 98, direction: 'out', amount: 70000 })
    expect(planSavingsMove(out, [move({ amount: 70000 }), out], []).ok).toBe(true)
  })
})
