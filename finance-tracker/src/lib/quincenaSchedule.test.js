import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCHEDULE,
  changeSchedule,
  describeSchedule,
  halfOf,
  MAX_SCHEDULE_ENTRIES,
  isOpenManual,
  latestPayday,
  keyFor,
  manualState,
  normalizeSchedule,
  rangeFor,
  registerPayday,
} from './quincenaSchedule'

const at = (y, m, d) => new Date(y, m - 1, d, 12)
const day = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const span = (date, schedule) => {
  const { start, end } = rangeFor(date, schedule)
  return [day(start), day(end)]
}
const paydays = (day1, day2 = null, from = '2000-01-01') => [
  { from, mode: 'paydays', day1, day2 },
]

describe('15/30 (the default)', () => {
  it('cuts at the 1st and the 16th', () => {
    expect(span(at(2026, 10, 1))).toEqual(['2026-10-01', '2026-10-15'])
    expect(span(at(2026, 10, 15))).toEqual(['2026-10-01', '2026-10-15'])
    expect(span(at(2026, 10, 16))).toEqual(['2026-10-16', '2026-10-31'])
    expect(span(at(2026, 10, 31))).toEqual(['2026-10-16', '2026-10-31'])
  })

  it.each([
    [2027, 2, '2027-02-28'],
    [2028, 2, '2028-02-29'],
    [2026, 4, '2026-04-30'],
    [2026, 12, '2026-12-31'],
  ])('ends the second half of %i-%i on %s', (y, m, last) => {
    expect(span(at(y, m, 20))[1]).toBe(last)
  })

  it('ends at 23:59:59 so the last day is inside', () => {
    const { end } = rangeFor(at(2026, 10, 3))
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([23, 59, 59])
  })
})

describe('pay days 5 and 20', () => {
  const schedule = paydays(5, 20)

  it('starts a quincena ON the pay day', () => {
    expect(span(at(2026, 10, 5), schedule)).toEqual(['2026-10-05', '2026-10-19'])
    expect(span(at(2026, 10, 4), schedule)).toEqual(['2026-09-20', '2026-10-04'])
    expect(span(at(2026, 10, 19), schedule)).toEqual(['2026-10-05', '2026-10-19'])
    expect(span(at(2026, 10, 20), schedule)).toEqual(['2026-10-20', '2026-11-04'])
  })

  it('crosses the year', () => {
    expect(span(at(2026, 12, 31), schedule)).toEqual(['2026-12-20', '2027-01-04'])
    expect(span(at(2027, 1, 2), schedule)).toEqual(['2026-12-20', '2027-01-04'])
    expect(span(at(2027, 1, 5), schedule)).toEqual(['2027-01-05', '2027-01-19'])
    expect(span(at(2026, 1, 1), schedule)).toEqual(['2025-12-20', '2026-01-04'])
  })

  it('is one continuous cut with no day lost or repeated', () => {
    let previous = span(new Date(2025, 11, 31, 12), schedule)
    for (let n = 0; n < 800; n++) {
      const date = new Date(2026, 0, 1 + n, 12)
      const current = span(date, schedule)
      expect(day(date) >= current[0] && day(date) <= current[1]).toBe(true)
      if (current[0] !== previous[0]) {
        const before = new Date(2026, 0, n, 12)
        expect(day(before)).toBe(previous[1])
      } else {
        expect(current).toEqual(previous)
      }
      previous = current
    }
  })
})

describe('a pay day that the month does not have', () => {
  it('uses the last day: 31 in a 30-day month', () => {
    const schedule = paydays(31)
    expect(span(at(2026, 4, 29), schedule)).toEqual(['2026-03-31', '2026-04-29'])
    expect(span(at(2026, 4, 30), schedule)).toEqual(['2026-04-30', '2026-05-30'])
    expect(span(at(2026, 5, 30), schedule)).toEqual(['2026-04-30', '2026-05-30'])
    expect(span(at(2026, 5, 31), schedule)).toEqual(['2026-05-31', '2026-06-29'])
  })

  it('uses the last day: 30 in a 28-day February', () => {
    const schedule = paydays(15, 30)
    expect(span(at(2027, 2, 27), schedule)).toEqual(['2027-02-15', '2027-02-27'])
    expect(span(at(2027, 2, 28), schedule)).toEqual(['2027-02-28', '2027-03-14'])
    expect(span(at(2027, 3, 14), schedule)).toEqual(['2027-02-28', '2027-03-14'])
    expect(span(at(2027, 3, 30), schedule)).toEqual(['2027-03-30', '2027-04-14'])
  })

  it('uses the last day: 31 in a 29-day (leap) February', () => {
    const schedule = paydays(10, 31)
    expect(span(at(2028, 2, 29), schedule)).toEqual(['2028-02-29', '2028-03-09'])
    expect(span(at(2028, 2, 28), schedule)).toEqual(['2028-02-10', '2028-02-28'])
  })

  it('has no quincena of its own when both days land on the same date', () => {
    const schedule = paydays(30, 31)
    // February 2027: both are the 28th, so only one quincena starts there
    expect(span(at(2027, 2, 28), schedule)).toEqual(['2027-02-28', '2027-03-29'])
    expect(span(at(2027, 3, 30), schedule)).toEqual(['2027-03-30', '2027-03-30'])
  })

  it('works in a 31-day month with the exact pay day', () => {
    const schedule = paydays(1, 31)
    expect(span(at(2026, 10, 31), schedule)).toEqual(['2026-10-31', '2026-10-31'])
    expect(span(at(2026, 11, 1), schedule)).toEqual(['2026-11-01', '2026-11-29'])
  })
})

describe('one pay day a month', () => {
  it('cuts one quincena per month', () => {
    const schedule = paydays(25)
    expect(span(at(2026, 12, 25), schedule)).toEqual(['2026-12-25', '2027-01-24'])
    expect(span(at(2027, 1, 24), schedule)).toEqual(['2026-12-25', '2027-01-24'])
  })

  it('treats a day-2 outside 1-31 as no second day', () => {
    expect(span(at(2026, 10, 10), normalizeSchedule(paydays(5, 99)))).toEqual(
      span(at(2026, 10, 10), paydays(5)),
    )
  })

  it('sorts two days given in reverse order', () => {
    const [entry] = normalizeSchedule(paydays(20, 5))
    expect([entry.day1, entry.day2]).toEqual([5, 20])
  })
})

describe('changes apply forward only', () => {
  // 15/30 until 2026-10-16, then pay days 5 and 20
  const schedule = [
    { from: '2000-01-01', mode: 'fixed', day1: 1, day2: 16 },
    { from: '2026-10-16', mode: 'paydays', day1: 5, day2: 20 },
  ]

  it('keeps every earlier quincena exactly as it was', () => {
    expect(span(at(2026, 10, 3), schedule)).toEqual(['2026-10-01', '2026-10-15'])
    expect(span(at(2026, 10, 15), schedule)).toEqual(['2026-10-01', '2026-10-15'])
    expect(span(at(2026, 9, 20), schedule)).toEqual(['2026-09-16', '2026-09-30'])
  })

  it('starts the new cut on the day it takes effect, not before', () => {
    // the 20th would be a pay day, but the 5th-19th quincena begins on the 16th
    expect(span(at(2026, 10, 16), schedule)).toEqual(['2026-10-16', '2026-10-19'])
    expect(span(at(2026, 10, 19), schedule)).toEqual(['2026-10-16', '2026-10-19'])
    expect(span(at(2026, 10, 20), schedule)).toEqual(['2026-10-20', '2026-11-04'])
  })

  it('ends the old cut where the new one starts, even when it would run on', () => {
    const late = [
      { from: '2000-01-01', mode: 'paydays', day1: 1, day2: null },
      { from: '2026-10-10', mode: 'paydays', day1: 12, day2: null },
    ]
    expect(span(at(2026, 10, 9), late)).toEqual(['2026-10-01', '2026-10-09'])
    expect(span(at(2026, 10, 10), late)).toEqual(['2026-10-10', '2026-10-11'])
  })

  it('has no gap or overlap across the change', () => {
    const before = rangeFor(at(2026, 10, 15), schedule).end
    const after = rangeFor(at(2026, 10, 16), schedule).start
    expect(day(new Date(before.getFullYear(), before.getMonth(), before.getDate() + 1))).toBe(
      day(after),
    )
  })
})

describe('changeSchedule', () => {
  const today = at(2026, 10, 7)
  const choice = { mode: 'paydays', day1: 5, day2: 20 }

  it('takes effect on the day after the quincena in progress', () => {
    const next = changeSchedule(DEFAULT_SCHEDULE, choice, today)
    expect(next).toHaveLength(2)
    expect(next[1]).toEqual({ from: '2026-10-16', mode: 'paydays', day1: 5, day2: 20 })
    // today's quincena does not move
    expect(span(today, next)).toEqual(['2026-10-01', '2026-10-15'])
  })

  it('on the last day of a quincena starts the very next day', () => {
    const next = changeSchedule(DEFAULT_SCHEDULE, choice, at(2026, 10, 15))
    expect(next[1].from).toBe('2026-10-16')
    const year = changeSchedule(DEFAULT_SCHEDULE, choice, at(2026, 12, 31))
    expect(year[1].from).toBe('2027-01-01')
  })

  it('replaces a change that was still waiting', () => {
    const first = changeSchedule(DEFAULT_SCHEDULE, choice, today)
    const second = changeSchedule(first, { mode: 'paydays', day1: 10, day2: null }, at(2026, 10, 9))
    expect(second).toHaveLength(2)
    expect(second[1]).toEqual({ from: '2026-10-16', mode: 'paydays', day1: 10, day2: null })
  })

  it('going back to what is in force cancels the waiting change', () => {
    const first = changeSchedule(DEFAULT_SCHEDULE, choice, today)
    const back = changeSchedule(first, { mode: 'fixed' }, at(2026, 10, 9))
    expect(back).toEqual(DEFAULT_SCHEDULE)
  })

  it('does nothing when the choice is what is already in force', () => {
    expect(changeSchedule(DEFAULT_SCHEDULE, { mode: 'fixed' }, today)).toEqual(
      DEFAULT_SCHEDULE,
    )
  })

  it('keeps old entries that already took effect', () => {
    const one = changeSchedule(DEFAULT_SCHEDULE, choice, today)
    const later = at(2026, 11, 6)
    const two = changeSchedule(one, { mode: 'fixed' }, later)
    expect(two.map((e) => e.mode)).toEqual(['fixed', 'paydays', 'fixed'])
    expect(two[2].from).toBe('2026-11-20')
  })

  it('ignores an invalid choice', () => {
    expect(changeSchedule(DEFAULT_SCHEDULE, { mode: 'paydays', day1: 40 }, today)).toEqual(
      DEFAULT_SCHEDULE,
    )
  })
})

describe('normalizeSchedule', () => {
  it('reads missing, empty or damaged data as 15/30', () => {
    for (const bad of [undefined, null, [], 'x', [{}], [{ from: 'bad', mode: 'fixed' }]]) {
      expect(normalizeSchedule(bad)).toEqual(DEFAULT_SCHEDULE)
    }
  })

  it('drops bad entries, sorts the rest and keeps one per date', () => {
    const list = normalizeSchedule([
      { from: '2026-10-16', mode: 'paydays', day1: 5, day2: 20 },
      { from: '2000-01-01', mode: 'fixed' },
      { from: '2026-11-01', mode: 'paydays', day1: 0 },
      { from: '2026-10-16', mode: 'paydays', day1: 7, day2: null },
    ])
    expect(list.map((e) => [e.from, e.day1])).toEqual([
      ['2000-01-01', 1],
      ['2026-10-16', 7],
    ])
  })

  it('uses the first entry for dates before it', () => {
    const schedule = paydays(5, 20, '2026-06-01')
    expect(span(at(2026, 3, 10), schedule)).toEqual(['2026-03-05', '2026-03-19'])
  })
})

describe('keyFor', () => {
  it('keeps the old form in 15/30', () => {
    expect(keyFor(at(2026, 10, 15))).toBe('2026-10-1')
    expect(keyFor(at(2026, 10, 16))).toBe('2026-10-2')
    expect(keyFor(at(2027, 2, 28))).toBe('2027-02-2')
  })

  it('uses the start date with pay days, the same for every day of it', () => {
    const schedule = paydays(5, 20)
    expect(keyFor(at(2026, 10, 5), schedule)).toBe('2026-10-05')
    expect(keyFor(at(2026, 10, 19), schedule)).toBe('2026-10-05')
    expect(keyFor(at(2026, 10, 20), schedule)).toBe('2026-10-20')
    expect(keyFor(at(2026, 10, 4), schedule)).toBe('2026-09-20')
  })
})

describe('halfOf', () => {
  it('is first/second of the month in 15/30', () => {
    expect(halfOf(at(2026, 10, 15))).toBe('first')
    expect(halfOf(at(2026, 10, 16))).toBe('second')
  })

  it('follows the pay days: the quincena starting on the first one is "first"', () => {
    const schedule = paydays(5, 20)
    expect(halfOf(at(2026, 10, 5), schedule)).toBe('first')
    expect(halfOf(at(2026, 10, 19), schedule)).toBe('first')
    expect(halfOf(at(2026, 10, 20), schedule)).toBe('second')
    // 1st-4th still belongs to the quincena that began on last month's 20th
    expect(halfOf(at(2026, 10, 2), schedule)).toBe('second')
  })

  it('is both with one pay day a month', () => {
    expect(halfOf(at(2026, 10, 9), paydays(5))).toBe('both')
  })
})

describe('describeSchedule', () => {
  it('gives the entry in force and the one waiting', () => {
    const next = changeSchedule(DEFAULT_SCHEDULE, { mode: 'paydays', day1: 5, day2: 20 }, at(2026, 10, 7))
    const now = describeSchedule(next, at(2026, 10, 7))
    expect(now.current.mode).toBe('fixed')
    expect(now.pending.from).toBe('2026-10-16')
    const later = describeSchedule(next, at(2026, 10, 20))
    expect(later.current.mode).toBe('paydays')
    expect(later.pending).toBeNull()
  })
})

describe('manual pay days ("I was paid")', () => {
  const manual = (...froms) => [
    ...DEFAULT_SCHEDULE,
    ...froms.map((from) => ({ from, mode: 'manual' })),
  ]

  it('normalizes a manual entry and ignores any days it carries', () => {
    // and it gets the 15/30 before it, so earlier days are still cut
    expect(normalizeSchedule([{ from: '2026-10-11', mode: 'manual', day1: 9, day2: 3 }])).toEqual([
      DEFAULT_SCHEDULE[0],
      { from: '2026-10-11', mode: 'manual', day1: 1, day2: null },
    ])
  })

  it('starts on the paid day and ends the day before the next payment', () => {
    const schedule = manual('2026-10-11', '2026-10-26')
    expect(span(at(2026, 10, 11), schedule)).toEqual(['2026-10-11', '2026-10-25'])
    expect(span(at(2026, 10, 20), schedule)).toEqual(['2026-10-11', '2026-10-25'])
    expect(span(at(2026, 10, 26), schedule)).toEqual(['2026-10-26', '2026-11-09'])
  })

  it('is counted as 15 days while open, and stays open when the payment is late', () => {
    const schedule = manual('2026-10-11')
    expect(span(at(2026, 10, 15), schedule)).toEqual(['2026-10-11', '2026-10-25'])
    expect(span(at(2026, 11, 3), schedule)).toEqual(['2026-10-11', '2026-11-03'])
  })

  it('leaves the quincenas before it cut the old way', () => {
    const schedule = manual('2026-10-11')
    expect(span(at(2026, 10, 5), schedule)).toEqual(['2026-10-01', '2026-10-10'])
    expect(span(at(2026, 9, 20), schedule)).toEqual(['2026-09-16', '2026-09-30'])
  })

  it('uses the start date as the key and the place in the month for halves', () => {
    const schedule = manual('2026-10-11', '2026-10-26')
    expect(keyFor(at(2026, 10, 15), schedule)).toBe('2026-10-11')
    expect(keyFor(at(2026, 10, 30), schedule)).toBe('2026-10-26')
    // Oct 1 (15/30) was the first of the month, so Oct 11 is the second and
    // Oct 26 a third one with no monthly items
    expect(halfOf(at(2026, 10, 5), schedule)).toBe('first')
    expect(halfOf(at(2026, 10, 15), schedule)).toBe('second')
    expect(halfOf(at(2026, 10, 30), schedule)).toBe('extra')
  })

  it('never makes a monthly item due twice in a month, whatever the days', () => {
    // paid on the 3rd and the 14th: both start before the 16th
    const schedule = [
      { from: '2000-01-01', mode: 'manual' },
      { from: '2026-10-03', mode: 'manual' },
      { from: '2026-10-14', mode: 'manual' },
      { from: '2026-11-02', mode: 'manual' },
    ]
    const halves = [at(2026, 10, 5), at(2026, 10, 20), at(2026, 11, 5)].map((d) => halfOf(d, schedule))
    expect(halves).toEqual(['first', 'second', 'first'])
  })

  it('drops dates that do not exist and puts 15/30 before a first manual entry', () => {
    expect(
      normalizeSchedule([
        { from: '2026-13-45', mode: 'manual' },
        { from: '2026-02-31', mode: 'manual' },
      ]),
    ).toEqual(DEFAULT_SCHEDULE)
    const only = normalizeSchedule([{ from: '2026-10-26', mode: 'manual' }])
    expect(span(at(2026, 10, 10), only)).toEqual(['2026-10-01', '2026-10-15'])
  })

  it('isOpenManual is true only for a manual quincena with no payment after it', () => {
    expect(isOpenManual(manual('2026-10-11'), at(2026, 10, 20))).toBe(true)
    expect(isOpenManual(manual('2026-10-11', '2026-10-26'), at(2026, 10, 20))).toBe(false)
    expect(isOpenManual(manual('2026-10-11', '2026-10-26'), at(2026, 10, 28))).toBe(true)
    expect(isOpenManual(DEFAULT_SCHEDULE, at(2026, 10, 20))).toBe(false)
  })

  it('manualState says when the next payment is late', () => {
    const schedule = manual('2026-10-11')
    expect(manualState(DEFAULT_SCHEDULE, at(2026, 10, 12))).toEqual({
      active: false,
      since: null,
      overdue: false,
    })
    expect(manualState(schedule, at(2026, 10, 25))).toEqual({
      active: true,
      since: '2026-10-11',
      overdue: false,
    })
    expect(manualState(schedule, at(2026, 10, 26)).overdue).toBe(true)
    // a registered next payment closes it: not late
    expect(manualState(manual('2026-10-11', '2026-10-26'), at(2026, 10, 28)).overdue).toBe(false)
  })
})

describe('registerPayday limits', () => {
  const today = at(2026, 10, 13)

  it('accepts a payment up to 45 days ahead and refuses one further away', () => {
    expect(latestPayday(today)).toBe('2026-11-27')
    expect(registerPayday(DEFAULT_SCHEDULE, '2026-11-27', today).ok).toBe(true)
    expect(registerPayday(DEFAULT_SCHEDULE, '2026-11-28', today)).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('refuses years outside 2000 to 2100', () => {
    expect(registerPayday(DEFAULT_SCHEDULE, '1999-12-31', today).reason).toBe('invalid')
    expect(registerPayday(DEFAULT_SCHEDULE, '2101-01-01', today).reason).toBe('invalid')
    expect(registerPayday(DEFAULT_SCHEDULE, '0001-01-01', today).reason).toBe('invalid')
  })
})

describe('normalizeSchedule limits', () => {
  it('drops entries with a year outside 2000 to 2100', () => {
    const result = normalizeSchedule([
      { from: '1999-05-01', mode: 'manual' },
      { from: '2101-05-01', mode: 'manual' },
      { from: '2026-10-11', mode: 'manual' },
    ])
    expect(result.map((entry) => entry.from)).toEqual(['2000-01-01', '2026-10-11'])
  })

  it('keeps the newest entries when there are too many', () => {
    const many = Array.from({ length: MAX_SCHEDULE_ENTRIES + 50 }, (_, index) => {
      const date = new Date(2000, 0, 1 + index * 3)
      return { from: day(date), mode: 'manual' }
    })
    const result = normalizeSchedule(many)
    // the old way of cutting is put back in front of a list that starts manual
    expect(result).toHaveLength(MAX_SCHEDULE_ENTRIES + 1)
    expect(result[result.length - 1].from).toBe(many[many.length - 1].from)
    expect(result[1].from).toBe(many[50].from)
  })
})

describe('registerPayday', () => {
  const today = at(2026, 10, 13)

  it('switches a 15/30 schedule to manual on a day of the quincena in progress', () => {
    const result = registerPayday(DEFAULT_SCHEDULE, '2026-10-11', today)
    expect(result.ok).toBe(true)
    expect(result.schedule).toEqual([
      DEFAULT_SCHEDULE[0],
      { from: '2026-10-11', mode: 'manual', day1: 1, day2: null },
    ])
    // what was lived before the paid day is not moved
    expect(span(at(2026, 10, 5), result.schedule)).toEqual(['2026-10-01', '2026-10-10'])
  })

  it('registers a new payment after the last one, and today is allowed', () => {
    const first = registerPayday(DEFAULT_SCHEDULE, '2026-10-11', today).schedule
    const later = at(2026, 10, 27)
    const result = registerPayday(first, '2026-10-27', later)
    expect(result.ok).toBe(true)
    expect(span(at(2026, 10, 20), result.schedule)).toEqual(['2026-10-11', '2026-10-26'])
    expect(span(later, result.schedule)[0]).toBe('2026-10-27')
  })

  it('registering the same start again changes nothing', () => {
    const first = registerPayday(DEFAULT_SCHEDULE, '2026-10-11', today).schedule
    expect(registerPayday(first, '2026-10-11', today)).toEqual({ ok: true, schedule: first })
  })

  it('rejects bad and too early dates, and accepts a future one', () => {
    expect(registerPayday(DEFAULT_SCHEDULE, 'ayer', today)).toEqual({ ok: false, reason: 'invalid' })
    expect(registerPayday(DEFAULT_SCHEDULE, '2026-02-30', today)).toEqual({ ok: false, reason: 'invalid' })
    // tomorrow is allowed: it is the next payment
    expect(registerPayday(DEFAULT_SCHEDULE, '2026-10-14', today).ok).toBe(true)
    // before the quincena in progress began (Oct 1): would move the past
    expect(registerPayday(DEFAULT_SCHEDULE, '2026-09-28', today)).toEqual({ ok: false, reason: 'early' })
    const first = registerPayday(DEFAULT_SCHEDULE, '2026-10-11', today).schedule
    expect(registerPayday(first, '2026-10-05', today)).toEqual({ ok: false, reason: 'early' })
  })

  it('drops a change that was waiting to take effect', () => {
    const waiting = [...DEFAULT_SCHEDULE, { from: '2026-11-01', mode: 'paydays', day1: 5, day2: 20 }]
    const result = registerPayday(waiting, '2026-10-12', today)
    expect(result.schedule.map((e) => e.from)).toEqual(['2000-01-01', '2026-10-12'])
  })
})

describe('registerPayday with a future payment', () => {
  const today = at(2026, 10, 13)

  it('keeps the quincena in progress until the paid day, then starts the new one', () => {
    const result = registerPayday(DEFAULT_SCHEDULE, '2026-10-14', today)
    expect(result.ok).toBe(true)
    expect(span(today, result.schedule)).toEqual(['2026-10-01', '2026-10-13'])
    expect(span(at(2026, 10, 14), result.schedule)[0]).toBe('2026-10-14')
    expect(describeSchedule(result.schedule, today).pending.from).toBe('2026-10-14')
  })
})

describe('late payment and switching away from manual', () => {
  const manual = [DEFAULT_SCHEDULE[0], { from: '2026-10-11', mode: 'manual' }]

  it('registerPayday drops a payment that was registered ahead of time', () => {
    const ahead = [...manual, { from: '2026-10-26', mode: 'manual' }]
    const result = registerPayday(ahead, '2026-10-20', new Date(2026, 9, 21))
    expect(result.ok).toBe(true)
    expect(result.schedule.map((e) => e.from)).toEqual(['2000-01-01', '2026-10-11', '2026-10-20'])
  })

  it('changeSchedule from a late manual quincena starts the new way the day after today', () => {
    const result = changeSchedule(manual, { mode: 'fixed' }, new Date(2026, 9, 30))
    expect(result[result.length - 1].from).toBe('2026-10-31')
  })
})
