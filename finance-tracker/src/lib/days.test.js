import { describe, expect, it } from 'vitest'
import { dayTitle, lastDays, longDate, pillDate, signedNet } from './days'

const t = (key) => ({ today: 'Hoy', yesterday: 'Ayer' })[key] ?? key
const today = new Date(2026, 9, 13) // Tuesday

describe('lastDays', () => {
  it('ends today and goes back, oldest first', () => {
    expect(lastDays(today, 7)).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
    ])
  })

  it('crosses the month and the year', () => {
    expect(lastDays(new Date(2027, 0, 2), 4)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })
})

describe('dayTitle', () => {
  it('says Hoy and Ayer, then the weekday, day and month', () => {
    expect(dayTitle('2026-10-13', today, 'es-CR', t)).toBe('Hoy')
    expect(dayTitle('2026-10-12', today, 'es-CR', t)).toBe('Ayer')
    expect(dayTitle('2026-10-09', today, 'es-CR', t)).toBe('vie 9 de octubre')
  })

  it('adds the year when asked', () => {
    expect(dayTitle('2025-10-09', today, 'es-CR', t, { year: true })).toBe(
      'jue 9 de octubre de 2025',
    )
  })

  it('works across a month boundary', () => {
    expect(dayTitle('2026-09-30', new Date(2026, 9, 1), 'es-CR', t)).toBe('Ayer')
    expect(dayTitle('2026-09-29', new Date(2026, 9, 1), 'es-CR', t)).toBe(
      'mar 29 de septiembre',
    )
  })

  it('writes English dates in the English order', () => {
    expect(dayTitle('2026-10-09', today, 'en-US', t)).toBe('Fri, Oct 9')
    expect(dayTitle('2025-10-09', today, 'en-US', t, { year: true })).toBe(
      'Thu, Oct 9, 2025',
    )
  })
})

describe('longDate', () => {
  it('writes the weekday in capitals and the date for the header of Home', () => {
    expect(longDate(new Date(2026, 9, 23), 'es-CR')).toBe('Viernes · 23 de octubre')
    expect(longDate(new Date(2026, 9, 23), 'en-US')).toBe('Friday · October 23')
  })
})

describe('pillDate', () => {
  it('says Hoy and Ayer, then day/month', () => {
    expect(pillDate('2026-10-13', today, 'es-CR', t)).toBe('Hoy')
    expect(pillDate('2026-10-12', today, 'es-CR', t)).toBe('Ayer')
    expect(pillDate('2026-10-09', today, 'es-CR', t)).toBe('09/10')
  })
})

describe('signedNet', () => {
  it('signs the net', () => {
    expect(signedNet(1000, 'CRC')).toBe('+₡1.000')
    expect(signedNet(-1000, 'CRC')).toBe('−₡1.000')
    expect(signedNet(0, 'CRC')).toBe('₡0')
    expect(signedNet(-12.5, 'USD')).toBe('−$12.50')
    expect(signedNet(12.5, 'USD')).toBe('+$12.50')
  })
})
