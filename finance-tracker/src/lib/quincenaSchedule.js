// When a quincena starts and ends. Pure functions: no database, no clock.
//
// A schedule is a list of entries, oldest first. Each entry says how the
// quincena was cut from its `from` date (YYYY-MM-DD) on:
//   { from, mode: 'fixed',   day1: 1, day2: 16 }  15/30: days 1 and 16
//   { from, mode: 'paydays', day1: 5, day2: 20 }  the person's pay days;
//                                                 day2 may be null (one a month)
//   { from, mode: 'manual' }                       pay days that move: a
//                                                 quincena starts on `from`,
//                                                 the day the person says they
//                                                 were paid (day1/day2 unused)
// A quincena STARTS on a pay day and lasts until the day before the next one.
// If the month is too short for a day (31 in April, 30 in February) the last
// day of the month is used. Changing the schedule adds an entry that takes
// effect later, so a date in the past is always cut the way it was then.

export const DEFAULT_SCHEDULE = [
  { from: '2000-01-01', mode: 'fixed', day1: 1, day2: 16 },
]

import { MAX_YEAR, MIN_YEAR } from './dates'

// A manual quincena has no known end until the next payment is registered:
// it is counted as this many days (and stays open if the payment is late)
export const MANUAL_QUINCENA_DAYS = 15

// The most entries a schedule keeps (the newest ones): a damaged file cannot
// grow it without end. 200 is about eight years of a payment every two weeks.
export const MAX_SCHEDULE_ENTRIES = 200

// "I was paid" accepts a date up to this many days after today (the next payment)
export const MAX_PAYDAY_AHEAD_DAYS = 45

const DAY = /^\d{4}-\d{2}-\d{2}$/

const isDay = (value) => Number.isInteger(value) && value >= 1 && value <= 31

function ymd(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function fromText(text) {
  const [year, month, day] = text.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function cleanEntry(entry) {
  if (!entry || typeof entry.from !== 'string' || !DAY.test(entry.from)) {
    return null
  }
  // a date that does not exist (2026-02-31, 2026-13-45) would roll over
  if (ymd(fromText(entry.from)) !== entry.from) return null
  // and a year that is surely a typo or a damaged file
  const year = Number(entry.from.slice(0, 4))
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  if (entry.mode === 'fixed') {
    return { from: entry.from, mode: 'fixed', day1: 1, day2: 16 }
  }
  if (entry.mode === 'manual') {
    return { from: entry.from, mode: 'manual', day1: 1, day2: null }
  }
  if (entry.mode !== 'paydays' || !isDay(entry.day1)) return null
  const day2 = isDay(entry.day2) ? entry.day2 : null
  const days = [entry.day1, day2].filter((day) => day !== null).sort((a, b) => a - b)
  return { from: entry.from, mode: 'paydays', day1: days[0], day2: days[1] ?? null }
}

// Anything unusable (missing, damaged, empty) reads as 15/30
export function normalizeSchedule(list) {
  if (!Array.isArray(list)) return DEFAULT_SCHEDULE
  const byDate = new Map()
  for (const item of list) {
    const entry = cleanEntry(item)
    if (entry) byDate.set(entry.from, entry)
  }
  const entries = [...byDate.values()]
    .sort((a, b) => a.from.localeCompare(b.from))
    .slice(-MAX_SCHEDULE_ENTRIES)
  if (entries.length === 0) return DEFAULT_SCHEDULE
  // a manual start needs the old way of cutting before it: without it the
  // days before that start would fall in a quincena that begins in the future
  return entries[0].mode === 'manual' ? [DEFAULT_SCHEDULE[0], ...entries] : entries
}

// The entry in force on a date; before the first one, the first one
function entryIndexAt(schedule, date) {
  const text = ymd(date)
  let found = 0
  schedule.forEach((entry, index) => {
    if (entry.from <= text) found = index
  })
  return found
}

// The pay days of one month (month is 0-11), sorted, without repeats
function paydaysOf(entry, year, month) {
  const last = new Date(year, month + 1, 0).getDate()
  const days = entry.mode === 'fixed' ? [1, 16] : [entry.day1, entry.day2]
  const resolved = days.filter((day) => day !== null).map((day) => Math.min(day, last))
  return [...new Set(resolved)].sort((a, b) => a - b)
}

// Every pay day of the months around a date, as dates, oldest first
function paydayDates(entry, date) {
  const dates = []
  for (let offset = -1; offset <= 1; offset++) {
    const first = new Date(date.getFullYear(), date.getMonth() + offset, 1)
    for (const day of paydaysOf(entry, first.getFullYear(), first.getMonth())) {
      dates.push(new Date(first.getFullYear(), first.getMonth(), day))
    }
  }
  return dates
}

// The quincena that contains a date: { start, end } with end at 23:59:59
export function rangeFor(date = new Date(), schedule = DEFAULT_SCHEDULE) {
  const index = entryIndexAt(schedule, date)
  const entry = schedule[index]
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  // manual: it starts on the day the person was paid and ends the day before
  // the next registered payment; the last one is open (see MANUAL_QUINCENA_DAYS)
  if (entry.mode === 'manual') {
    const first = fromText(entry.from)
    const next = schedule[index + 1]
    let last
    if (next) {
      const limit = fromText(next.from)
      last = new Date(limit.getFullYear(), limit.getMonth(), limit.getDate() - 1)
    } else {
      last = new Date(
        first.getFullYear(),
        first.getMonth(),
        first.getDate() + MANUAL_QUINCENA_DAYS - 1,
      )
      if (last < day) last = day
    }
    return {
      start: first,
      end: new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59),
    }
  }

  const paydays = paydayDates(entry, day)

  let start = paydays[0]
  let next = paydays[paydays.length - 1]
  for (let i = 0; i < paydays.length; i++) {
    if (paydays[i] <= day) start = paydays[i]
    else {
      next = paydays[i]
      break
    }
  }

  // a new schedule does not reach back before the day it starts
  const from = fromText(entry.from)
  if (index > 0 && start < from) start = from
  // and the old one stops where the new one starts
  const following = schedule[index + 1]
  if (following) {
    const limit = fromText(following.from)
    if (limit < next) next = limit
  }

  return {
    start,
    end: new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1, 23, 59, 59),
  }
}

// How many quincenas started earlier in the same month as `start`
function startedBefore(start, schedule) {
  let count = 0
  let cursor = start
  for (let i = 0; i < 5; i++) {
    const day = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
    const previous = rangeFor(day, schedule).start
    if (
      previous.getFullYear() !== start.getFullYear() ||
      previous.getMonth() !== start.getMonth() ||
      previous >= cursor
    ) {
      break
    }
    count++
    cursor = previous
  }
  return count
}

// The kind of month position of the quincena of a date, for monthly items:
// 'first' or 'second' of the month, or 'both' when there is one pay day a
// month (a monthly item is then due every time)
export function halfOf(date = new Date(), schedule = DEFAULT_SCHEDULE) {
  const entry = schedule[entryIndexAt(schedule, date)]
  const { start } = rangeFor(date, schedule)
  // manual: by its place among the quincenas that started in the same month
  // (the first is 'first', the next 'second'; a third has no monthly items,
  // 'extra'), so a monthly item is never due twice in a month
  if (entry.mode === 'manual') {
    const before = startedBefore(start, schedule)
    return before === 0 ? 'first' : before === 1 ? 'second' : 'extra'
  }
  const days = paydaysOf(entry, start.getFullYear(), start.getMonth())
  if (days.length < 2) return 'both'
  return start.getDate() >= days[1] ? 'second' : 'first'
}

// Text that identifies a quincena, to remember that something was handled in
// it. 15/30 keeps the old form ('2026-10-1' / '2026-10-2') so values saved by
// earlier versions still match; any other schedule uses the start date.
export function keyFor(date = new Date(), schedule = DEFAULT_SCHEDULE) {
  const entry = schedule[entryIndexAt(schedule, date)]
  if (entry.mode === 'fixed') {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${date.getDate() <= 15 ? 1 : 2}`
  }
  return ymd(rangeFor(date, schedule).start)
}

// The schedule after the person chooses a new way to cut the quincena.
// The quincena in progress is left as it is: the choice takes effect on the
// first day after it. A choice that was waiting to take effect is replaced,
// and choosing what is already in force changes nothing.
export function changeSchedule(schedule, choice, today = new Date()) {
  const current = normalizeSchedule(schedule)
  const todayText = ymd(today)
  const kept = current.filter((entry, index) => index === 0 || entry.from <= todayText)
  const { end } = rangeFor(today, kept)
  const from = ymd(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1))
  const entry = cleanEntry({ ...choice, from })
  if (!entry) return current

  const inForce = kept[kept.length - 1]
  const same =
    inForce.mode === entry.mode &&
    inForce.day1 === entry.day1 &&
    inForce.day2 === entry.day2
  return same ? kept : [...kept, entry]
}

// What Settings shows: the entry in force today and the one waiting, if any
export function describeSchedule(schedule, today = new Date()) {
  const list = normalizeSchedule(schedule)
  const index = entryIndexAt(list, today)
  const pending = list.find((entry) => entry.from > ymd(today)) ?? null
  return { current: list[index], pending }
}

// True when the quincena of a date is a manual one with no payment
// registered after it: its end is not known
export function isOpenManual(schedule, date = new Date()) {
  const list = normalizeSchedule(schedule)
  const index = entryIndexAt(list, date)
  return list[index].mode === 'manual' && !list[index + 1]
}

// Whether the quincena in force is manual, since when, and whether the next
// payment is late (the open quincena already lasts more than
// MANUAL_QUINCENA_DAYS). overdue is false when the schedule is not manual.
export function manualState(schedule, today = new Date()) {
  const list = normalizeSchedule(schedule)
  const entry = list[entryIndexAt(list, today)]
  if (entry.mode !== 'manual') return { active: false, since: null, overdue: false }
  const { end } = rangeFor(today, list)
  const open = !list[entryIndexAt(list, today) + 1]
  const lastExpected = fromText(entry.from)
  lastExpected.setDate(lastExpected.getDate() + MANUAL_QUINCENA_DAYS - 1)
  return {
    active: true,
    since: entry.from,
    overdue: open && ymd(end) > ymd(lastExpected),
  }
}

// The latest day "I was paid" accepts: today plus MAX_PAYDAY_AHEAD_DAYS, as text
export function latestPayday(today = new Date()) {
  const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  limit.setDate(limit.getDate() + MAX_PAYDAY_AHEAD_DAYS)
  return ymd(limit)
}

// "I was paid": a new quincena starts on `dateText` (YYYY-MM-DD). Returns
//   { ok: true, schedule }  the new schedule (the same one if that date is
//                           already the start of the manual quincena)
//   { ok: false, reason }   'invalid' (not a date, a year outside MIN_YEAR to
//                           MAX_YEAR, or more than MAX_PAYDAY_AHEAD_DAYS after
//                           today) or 'early' (before the
//                           quincena in progress began: that would move
//                           quincenas already lived)
// A date after today is allowed up to then: it is the next payment, and the new quincena
// starts that day (until then the one in progress goes on).
// The quincena before ends the day before. A change that was waiting to take
// effect is dropped. Works from any mode: the first time it switches to manual.
export function registerPayday(schedule, dateText, today = new Date()) {
  if (typeof dateText !== 'string' || !DAY.test(dateText)) {
    return { ok: false, reason: 'invalid' }
  }
  if (Number.isNaN(fromText(dateText).getTime()) || ymd(fromText(dateText)) !== dateText) {
    return { ok: false, reason: 'invalid' }
  }
  const year = Number(dateText.slice(0, 4))
  if (year < MIN_YEAR || year > MAX_YEAR || dateText > latestPayday(today)) {
    return { ok: false, reason: 'invalid' }
  }
  const todayText = ymd(today)

  const current = normalizeSchedule(schedule)
  const kept = current.filter((entry, index) => index === 0 || entry.from <= todayText)
  const { start } = rangeFor(today, kept)
  if (dateText < ymd(start)) return { ok: false, reason: 'early' }

  const inForce = kept[kept.length - 1]
  if (inForce.mode === 'manual' && inForce.from === dateText) {
    return { ok: true, schedule: kept }
  }
  const next = normalizeSchedule([...kept, { from: dateText, mode: 'manual' }])
  return { ok: true, schedule: next }
}
