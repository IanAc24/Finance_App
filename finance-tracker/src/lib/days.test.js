import { describe, expect, it } from 'vitest'
import { dayHeading, lastDays, signedNet } from './days'

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

describe('dayHeading', () => {
  it('says Hoy and Ayer, then the weekday and date', () => {
    expect(dayHeading('2026-10-13', today, 'es-CR', t)).toBe('Hoy · mar 13/10')
    expect(dayHeading('2026-10-12', today, 'es-CR', t)).toBe('Ayer · lun 12/10')
    expect(dayHeading('2026-10-09', today, 'es-CR', t)).toBe('vie 09/10')
  })

  it('adds the year when asked', () => {
    expect(dayHeading('2025-10-09', today, 'es-CR', t, { year: true })).toBe(
      'jue 09/10/2025',
    )
  })

  it('works across a month boundary', () => {
    expect(dayHeading('2026-09-30', new Date(2026, 9, 1), 'es-CR', t)).toBe(
      'Ayer · mié 30/09',
    )
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
