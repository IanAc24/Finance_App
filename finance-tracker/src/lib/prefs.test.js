import { describe, expect, it } from 'vitest'
import { BACKUP_SNOOZE_PREF, ERASED_PREFS, removePref } from './prefs'
import { CONSENT_PREF } from './legal'

describe('ERASED_PREFS', () => {
  it('lists the last-used choices, backup dates and old-version keys', () => {
    expect([...ERASED_PREFS].sort()).toEqual(
      [
        'lastCurrency',
        'lastPaymentMethod',
        'lastCategoryId',
        'lastBackup',
        BACKUP_SNOOZE_PREF,
        'finance-data',
        'finance-data-imported',
      ].sort(),
    )
  })

  it('keeps language, theme and the consent record', () => {
    for (const kept of ['lang', 'theme', CONSENT_PREF]) {
      expect(ERASED_PREFS).not.toContain(kept)
    }
  })

  it('has no repeated key', () => {
    expect(new Set(ERASED_PREFS).size).toBe(ERASED_PREFS.length)
  })

  it('removes every listed key from localStorage and nothing else', () => {
    const store = new Map(
      [...ERASED_PREFS, 'lang', 'theme', CONSENT_PREF].map((k) => [k, 'x']),
    )
    const original = globalThis.localStorage
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    }
    try {
      ERASED_PREFS.forEach((key) => removePref(key))
      expect([...store.keys()].sort()).toEqual(['lang', CONSENT_PREF, 'theme'].sort())
    } finally {
      globalThis.localStorage = original
    }
  })
})
