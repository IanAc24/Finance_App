import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_PREF,
  LEGAL_DOCS,
  LEGAL_VERSION,
  buildConsent,
  hasCurrentConsent,
  isLegalDoc,
  parseConsent,
  readConsent,
  withdrawConsent,
  writeConsent,
} from './legal'

describe('parseConsent', () => {
  const good = { version: '1.0', acceptedAt: '2026-10-23T15:30:00.000Z' }

  it('reads what writeConsent saves', () => {
    expect(parseConsent(JSON.stringify(good))).toEqual(good)
  })

  it('gives null when there is nothing or it is not valid', () => {
    expect(parseConsent(null)).toBeNull()
    expect(parseConsent(undefined)).toBeNull()
    expect(parseConsent('')).toBeNull()
    expect(parseConsent('{bad json')).toBeNull()
    expect(parseConsent('null')).toBeNull()
    expect(parseConsent('"1.0"')).toBeNull()
    expect(parseConsent('42')).toBeNull()
    expect(parseConsent('{}')).toBeNull()
    expect(parseConsent(JSON.stringify({ version: 1, acceptedAt: good.acceptedAt }))).toBeNull()
    expect(parseConsent(JSON.stringify({ version: '', acceptedAt: good.acceptedAt }))).toBeNull()
    expect(parseConsent(JSON.stringify({ version: '1.0' }))).toBeNull()
    expect(parseConsent(JSON.stringify({ version: '1.0', acceptedAt: 'ayer' }))).toBeNull()
    expect(parseConsent(JSON.stringify({ version: '1.0', acceptedAt: 5 }))).toBeNull()
  })

  it('drops extra fields', () => {
    expect(parseConsent(JSON.stringify({ ...good, extra: true }))).toEqual(good)
  })
})

describe('hasCurrentConsent', () => {
  it('accepts only the current version', () => {
    const at = '2026-10-23T15:30:00.000Z'
    expect(hasCurrentConsent({ version: LEGAL_VERSION, acceptedAt: at })).toBe(true)
    expect(hasCurrentConsent({ version: '0.9', acceptedAt: at })).toBe(false)
    expect(hasCurrentConsent({ version: '99.0', acceptedAt: at })).toBe(false)
    expect(hasCurrentConsent(null)).toBe(false)
    expect(hasCurrentConsent(undefined)).toBe(false)
  })
})

describe('buildConsent', () => {
  it('uses the current version and the moment of acceptance', () => {
    const now = new Date('2026-10-23T15:30:00.000Z')
    expect(buildConsent(now)).toEqual({
      version: LEGAL_VERSION,
      acceptedAt: '2026-10-23T15:30:00.000Z',
    })
  })
})

describe('legal documents', () => {
  it('lists the four documents with a title key each', () => {
    expect(LEGAL_DOCS.map((d) => d.id)).toEqual(['privacy', 'terms', 'refunds', 'cookies'])
    for (const doc of LEGAL_DOCS) expect(doc.titleKey).toMatch(/^legal/)
  })

  it('knows which names are documents', () => {
    expect(isLegalDoc('privacy')).toBe(true)
    expect(isLegalDoc('cookies')).toBe(true)
    expect(isLegalDoc('nope')).toBe(false)
    expect(isLegalDoc(undefined)).toBe(false)
    expect(isLegalDoc('__proto__')).toBe(false)
  })
})

describe('the saved consent on the device', () => {
  let store

  beforeEach(() => {
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is missing at first', () => {
    expect(readConsent()).toBeNull()
  })

  it('is saved, read back and withdrawn', () => {
    const consent = writeConsent(new Date('2026-10-23T15:30:00.000Z'))
    expect(consent).toEqual({ version: LEGAL_VERSION, acceptedAt: '2026-10-23T15:30:00.000Z' })
    expect(store.has(CONSENT_PREF)).toBe(true)
    expect(readConsent()).toEqual(consent)
    withdrawConsent()
    expect(store.has(CONSENT_PREF)).toBe(false)
    expect(readConsent()).toBeNull()
  })

  it('treats a damaged saved value as no consent', () => {
    store.set(CONSENT_PREF, '{oops')
    expect(readConsent()).toBeNull()
  })

  it('does not fail when the storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readConsent()).toBeNull()
    expect(writeConsent(new Date()).version).toBe(LEGAL_VERSION)
    expect(() => withdrawConsent()).not.toThrow()
  })
})
