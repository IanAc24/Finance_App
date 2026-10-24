import { describe, expect, it } from 'vitest'
import { RESET_SENT, UNKNOWN_ERROR, authErrorKey, resetResultKey } from './authErrors'
import { translations } from './translations'

const error = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code })

describe('authErrorKey', () => {
  it('gives the same message for a wrong password and an unknown email', () => {
    const wrong = authErrorKey(error('auth/wrong-password'))
    expect(authErrorKey(error('auth/user-not-found'))).toBe(wrong)
    expect(authErrorKey(error('auth/invalid-credential'))).toBe(wrong)
    expect(authErrorKey(error('auth/user-disabled'))).toBe(wrong)
  })

  it('has its own message for the other known problems', () => {
    expect(authErrorKey(error('auth/email-already-in-use'))).toBe('authEmailInUse')
    expect(authErrorKey(error('auth/too-many-requests'))).toBe('authTooManyAttempts')
    expect(authErrorKey(error('auth/network-request-failed'))).toBe('authOffline')
    expect(authErrorKey(error('auth/invalid-email'))).toBe('authInvalidEmail')
  })

  it('falls back to a generic message, never the raw text', () => {
    expect(authErrorKey(error('auth/something-new'))).toBe(UNKNOWN_ERROR)
    expect(authErrorKey(new Error('boom'))).toBe(UNKNOWN_ERROR)
    expect(authErrorKey(undefined)).toBe(UNKNOWN_ERROR)
    expect(authErrorKey(null)).toBe(UNKNOWN_ERROR)
  })

  it('only returns keys that exist in both languages', () => {
    const codes = [
      'auth/wrong-password',
      'auth/email-already-in-use',
      'auth/weak-password',
      'auth/too-many-requests',
      'auth/network-request-failed',
      'auth/invalid-email',
      'auth/other',
    ]
    for (const code of codes) {
      const key = authErrorKey(error(code))
      expect(translations.es[key], code).toBeTruthy()
      expect(translations.en[key], code).toBeTruthy()
    }
  })
})

describe('resetResultKey', () => {
  it('says the link was sent when it worked', () => {
    expect(resetResultKey(null)).toBe(RESET_SENT)
  })

  it('says the same when the email has no account, so nobody can tell', () => {
    expect(resetResultKey(error('auth/user-not-found'))).toBe(RESET_SENT)
    expect(resetResultKey(error('auth/invalid-email'))).toBe(RESET_SENT)
  })

  it('still reports problems that are not about the account', () => {
    expect(resetResultKey(error('auth/network-request-failed'))).toBe('authOffline')
    expect(resetResultKey(error('auth/too-many-requests'))).toBe('authTooManyAttempts')
    expect(resetResultKey(error('auth/other'))).toBe(UNKNOWN_ERROR)
  })
})

describe('setup problems', () => {
  it('explains a bad or blocked Firebase key instead of "something went wrong"', () => {
    // the exact code Firebase gives for a wrong API key
    expect(authErrorKey(error('auth/api-key-not-valid.-please-pass-a-valid-api-key.'))).toBe('authBadConfig')
    expect(authErrorKey(error('auth/invalid-api-key'))).toBe('authBadConfig')
    expect(
      authErrorKey(error('auth/requests-from-referer-https://algo.netlify.app-are-blocked.')),
    ).toBe('authBadConfig')
  })

  it('says when email and password are not turned on, or sign-up is off', () => {
    expect(authErrorKey(error('auth/operation-not-allowed'))).toBe('authMethodDisabled')
    expect(authErrorKey(error('auth/configuration-not-found'))).toBe('authMethodDisabled')
    expect(authErrorKey(error('auth/admin-restricted-operation'))).toBe('authSignUpDisabled')
  })

  it('also shows them on password recovery, where they are not about the account', () => {
    expect(resetResultKey(error('auth/api-key-not-valid.-please-pass-a-valid-api-key.'))).toBe('authBadConfig')
    expect(resetResultKey(error('auth/operation-not-allowed'))).toBe('authMethodDisabled')
  })

  it('ignores codes that are not text', () => {
    expect(authErrorKey({ code: 42 })).toBe(UNKNOWN_ERROR)
  })
})
