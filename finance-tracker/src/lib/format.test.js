import { describe, expect, it } from 'vitest'
import { formatDate, formatMonth, monthName } from './format'

const date = new Date(2026, 9, 13) // Tuesday

describe('formatDate', () => {
  it('writes dd/mm/yyyy in Spanish (Costa Rica)', () => {
    expect(formatDate(date, 'es-CR')).toBe('13/10/2026')
    expect(formatDate(new Date(2026, 0, 5), 'es-CR')).toBe('05/01/2026')
  })

  it('keeps the leading zero of day and month, with or without the year', () => {
    const early = new Date(2026, 0, 4)
    expect(formatDate(early, 'es-CR')).toBe('04/01/2026')
    expect(formatDate(early, 'es-CR', { year: false })).toBe('04/01')
    expect(formatDate(early, 'es-CR', { weekday: true, year: false })).toBe(
      'dom 04/01',
    )
  })

  it('leaves the year out when asked', () => {
    expect(formatDate(date, 'es-CR', { year: false })).toBe('13/10')
    expect(formatDate(date, 'en-US', { year: false })).toBe('Oct 13')
  })

  it('puts the weekday first', () => {
    expect(formatDate(date, 'es-CR', { weekday: true, year: false })).toBe(
      'mar 13/10',
    )
    expect(formatDate(date, 'en-US', { weekday: true, year: false })).toBe(
      'Tue, Oct 13',
    )
  })

  it('keeps the US text in English', () => {
    expect(formatDate(date, 'en-US')).toBe('Oct 13, 2026')
  })
})

describe('formatMonth', () => {
  it('names the month in each language', () => {
    expect(formatMonth(date, 'es-CR')).toBe('Octubre de 2026')
    expect(formatMonth(date, 'en-US')).toBe('October 2026')
  })

  it('capitalises only the month name in Spanish', () => {
    expect(formatMonth(new Date(2026, 2, 1), 'es-CR')).toBe('Marzo de 2026')
  })
})

describe('monthName', () => {
  it('gives the month alone, ready for a sentence', () => {
    expect(monthName(date, 'es-CR')).toBe('octubre')
    expect(monthName(date, 'en-US')).toBe('October')
  })
})
