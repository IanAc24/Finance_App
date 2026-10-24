import { describe, expect, it, vi, afterEach } from 'vitest'
import { browserLanguages, initialLanguage } from './language'

describe('initialLanguage', () => {
  it('a saved choice wins over the browser', () => {
    expect(initialLanguage('en', ['es-CR'])).toBe('en')
    expect(initialLanguage('es', ['en-US'])).toBe('es')
  })

  it('uses the first Spanish or English browser language', () => {
    expect(initialLanguage(null, ['en-US', 'es'])).toBe('en')
    expect(initialLanguage(null, ['es-CR', 'en'])).toBe('es')
    expect(initialLanguage(null, ['EN-gb'])).toBe('en')
    expect(initialLanguage(null, ['ES'])).toBe('es')
  })

  it('skips unsupported languages before a supported one', () => {
    expect(initialLanguage(null, ['fr-FR', 'en-US'])).toBe('en')
  })

  it('falls back to Spanish', () => {
    expect(initialLanguage(null, ['fr-FR', 'de'])).toBe('es')
    expect(initialLanguage(null, [])).toBe('es')
    expect(initialLanguage(null, undefined)).toBe('es')
    expect(initialLanguage('fr', ['fr'])).toBe('es')
    expect(initialLanguage(null, [null, 42])).toBe('es')
  })

  it('does not mistake other codes starting with the same letters', () => {
    expect(initialLanguage(null, ['eng', 'est'])).toBe('es')
    expect(initialLanguage(null, ['est', 'en'])).toBe('en')
  })
})

describe('browserLanguages', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns an empty list without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    expect(browserLanguages()).toEqual([])
  })

  it('prefers navigator.languages, then navigator.language', () => {
    vi.stubGlobal('navigator', { languages: ['en-US'], language: 'es' })
    expect(browserLanguages()).toEqual(['en-US'])
    vi.stubGlobal('navigator', { languages: [], language: 'es-CR' })
    expect(browserLanguages()).toEqual(['es-CR'])
  })
})
