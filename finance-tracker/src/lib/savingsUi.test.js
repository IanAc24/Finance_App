import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILL,
  MIN_FILL,
  amountProblem,
  barRatios,
  dateProblem,
  fillTemplate,
  goalProgress,
  moveOutcome,
  nextGoal,
  pigFill,
  reachedGoals,
  yearsWithSavings,
} from './savingsUi'

const goal = (over) => ({
  id: 1,
  name: 'Trip',
  target: 500000,
  currency: 'CRC',
  createdAt: '2026-01-01',
  achievedAt: null,
  ...over,
})

describe('nextGoal', () => {
  it('is the nearest unreached goal of the currency', () => {
    const goals = [
      goal({ id: 1, target: 900000 }),
      goal({ id: 2, target: 300000 }),
      goal({ id: 3, target: 100, currency: 'USD' }),
      goal({ id: 4, target: 50000, achievedAt: '2026-02-02' }),
    ]
    expect(nextGoal(goals, 'CRC').id).toBe(2)
    expect(nextGoal(goals, 'USD').id).toBe(3)
  })

  it('breaks a tie with the older goal and is null with none left', () => {
    expect(nextGoal([goal({ id: 9 }), goal({ id: 5 })], 'CRC').id).toBe(5)
    expect(nextGoal([goal({ achievedAt: '2026-02-02' })], 'CRC')).toBeNull()
    expect(nextGoal([], 'CRC')).toBeNull()
  })
})

describe('goalProgress', () => {
  it('is a ratio and a whole percent, 100 only when really reached', () => {
    expect(goalProgress(goal({ target: 15000 }), 5000)).toEqual({ ratio: 5000 / 15000, percent: 33 })
    expect(goalProgress(goal({ target: 15000 }), 14999.99).percent).toBe(99)
    expect(goalProgress(goal({ target: 15000 }), 15000).percent).toBe(100)
    expect(goalProgress(goal({ target: 15000 }), 99999).ratio).toBe(1)
    expect(goalProgress(goal({ target: 15000 }), 0).percent).toBe(0)
    expect(goalProgress(goal({ target: 15000 }), -50).ratio).toBe(0)
  })

  it('a goal reached once stays at 100% after a withdrawal', () => {
    expect(goalProgress(goal({ target: 15000, achievedAt: '2026-03-03' }), 100).percent).toBe(100)
  })
})

describe('pigFill', () => {
  it('is empty with nothing saved', () => {
    expect(pigFill(0, goal())).toBe(0)
    expect(pigFill(-10, null)).toBe(0)
  })

  it('follows the progress towards the goal, never a sliver', () => {
    expect(pigFill(250000, goal())).toBe(0.5)
    expect(pigFill(1, goal())).toBe(MIN_FILL)
    expect(pigFill(900000, goal())).toBe(1)
  })

  it('has a gentle default without a goal', () => {
    expect(pigFill(1000, null)).toBe(DEFAULT_FILL)
  })
})

describe('moveOutcome', () => {
  it('a pending write plays nothing and says it will be saved later', () => {
    expect(moveOutcome({ direction: 'in', status: 'pending', achievedGoalIds: [3] })).toEqual({
      animation: null,
      message: 'pending',
      celebrate: false,
    })
  })

  it('a confirmed deposit drops the coin; goals make it a milestone', () => {
    expect(moveOutcome({ direction: 'in', status: 'confirmed', achievedGoalIds: [] })).toEqual({
      animation: 'deposit',
      message: 'deposit',
      celebrate: false,
    })
    expect(moveOutcome({ direction: 'in', status: 'confirmed', achievedGoalIds: [7] })).toEqual({
      animation: 'deposit',
      message: 'goal',
      celebrate: true,
    })
  })

  it('a withdrawal is restrained and never celebrates', () => {
    expect(moveOutcome({ direction: 'out', status: 'confirmed', achievedGoalIds: [7] })).toEqual({
      animation: 'withdraw',
      message: 'withdraw',
      celebrate: false,
    })
  })

  it('without an answer to look at (a reload) there is nothing to celebrate', () => {
    expect(moveOutcome({ direction: 'in', status: 'confirmed' }).celebrate).toBe(false)
  })
})

describe('reachedGoals and fillTemplate', () => {
  it('finds the goals by id and skips unknown ones', () => {
    const goals = [goal({ id: 1 }), goal({ id: 2, name: 'House' })]
    expect(reachedGoals([2, 99], goals).map((g) => g.name)).toEqual(['House'])
    expect(reachedGoals([], goals)).toEqual([])
  })

  it('fills the placeholders and leaves unknown ones', () => {
    expect(fillTemplate('You put {amount} in {x}', { amount: '₡10.000' })).toBe(
      'You put ₡10.000 in {x}',
    )
  })
})

describe('amountProblem', () => {
  const dep = { direction: 'in', balance: 0 }
  it('judges the text', () => {
    expect(amountProblem('', dep)).toBe('empty')
    expect(amountProblem('0', dep)).toBe('zero')
    expect(amountProblem('abc', dep)).toBe('invalid')
    expect(amountProblem('-5', dep)).toBe('invalid')
    expect(amountProblem('1.500', dep)).toBeNull()
    expect(amountProblem('12,50', dep)).toBeNull()
  })

  it('knows an amount above the global limit from a typo', () => {
    expect(amountProblem('1000000001', dep)).toBe('tooBig')
    expect(amountProblem('1.000.000.001', dep)).toBe('tooBig')
    expect(amountProblem('1000000000', dep)).toBeNull()
  })

  it('a withdrawal cannot be larger than the balance, to the cent', () => {
    const out = { direction: 'out', balance: 10000 }
    expect(amountProblem('10000', out)).toBeNull()
    expect(amountProblem('10000,01', out)).toBe('aboveBalance')
    expect(amountProblem('10001', out)).toBe('aboveBalance')
    expect(amountProblem('1', { direction: 'out', balance: 0 })).toBe('aboveBalance')
    expect(amountProblem('999999', dep)).toBeNull()
  })
})

describe('dateProblem', () => {
  const today = new Date(2026, 9, 24)
  it('accepts today and the past, refuses the future and nonsense', () => {
    expect(dateProblem('2026-10-24', today)).toBeNull()
    expect(dateProblem('2025-01-01', today)).toBeNull()
    expect(dateProblem('2026-10-25', today)).toBe('future')
    expect(dateProblem('', today)).toBe('invalid')
    expect(dateProblem('2026-02-30', today)).toBe('invalid')
  })
})

describe('barRatios', () => {
  it('the larger bar is full', () => {
    expect(barRatios(200, 100)).toEqual([1, 0.5])
    expect(barRatios(0, 100)).toEqual([0, 1])
    expect(barRatios(0, 0)).toEqual([0, 0])
    expect(barRatios(-5, 10)).toEqual([0, 1])
  })
})

describe('yearsWithSavings', () => {
  const moves = [
    { id: 1, amount: 100, currency: 'CRC', direction: 'in', note: '', date: '2025-05-01' },
    { id: 2, amount: 40, currency: 'CRC', direction: 'out', note: '', date: '2026-02-01' },
    { id: 3, amount: 9, currency: 'USD', direction: 'in', note: '', date: '2024-02-01' },
  ]
  it('lists the years of one currency that had moves, with their numbers', () => {
    expect(yearsWithSavings(moves, [2026, 2025, 2024], 'CRC')).toEqual([
      { year: 2026, opening: 100, deposits: 0, withdrawals: 40, closing: 60 },
      { year: 2025, opening: 0, deposits: 100, withdrawals: 0, closing: 100 },
    ])
    expect(yearsWithSavings(moves, [2026, 2025, 2024], 'USD').map((r) => r.year)).toEqual([2024])
  })
})
