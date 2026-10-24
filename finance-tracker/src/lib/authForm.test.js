import { describe, expect, it } from 'vitest'
import {
  MIN_PASSWORD_LENGTH,
  firstErrorField,
  isValidEmail,
  runOnce,
  safeRedirect,
  submitForm,
  validateReset,
  validateSignIn,
  validateSignUp,
} from './authForm'

describe('isValidEmail', () => {
  it('accepts normal addresses, with spaces around', () => {
    expect(isValidEmail('ana@ejemplo.com')).toBe(true)
    expect(isValidEmail('  ana.mora+casa@correo.co.cr ')).toBe(true)
  })

  it('rejects text that is not an address', () => {
    for (const text of ['', ' ', 'ana', 'ana@', '@ejemplo.com', 'ana@ejemplo', 'a na@x.com', undefined, null]) {
      expect(isValidEmail(text), String(text)).toBe(false)
    }
  })
})

describe('validateSignIn', () => {
  it('passes with an email and any password', () => {
    expect(validateSignIn({ email: 'ana@ejemplo.com', password: 'x' })).toEqual({})
  })

  it('asks for a valid email and a password', () => {
    expect(validateSignIn({ email: 'ana', password: '' })).toEqual({
      email: 'authInvalidEmail',
      password: 'authPasswordRequired',
    })
  })
})

describe('validateSignUp', () => {
  const good = { email: 'ana@ejemplo.com', password: '12345678', confirm: '12345678' }

  it('passes with a valid email and matching passwords of 8 or more', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(validateSignUp(good)).toEqual({})
  })

  it('rejects a password shorter than 8', () => {
    expect(validateSignUp({ ...good, password: '1234567', confirm: '1234567' })).toEqual({
      password: 'authPasswordTooShort',
    })
  })

  it('rejects a confirmation that does not match', () => {
    expect(validateSignUp({ ...good, confirm: '12345679' })).toEqual({
      confirm: 'authPasswordMismatch',
    })
  })

  it('does not trim the password (spaces count)', () => {
    expect(validateSignUp({ ...good, password: '1234567 ', confirm: '1234567' })).toEqual({
      confirm: 'authPasswordMismatch',
    })
  })
})

describe('validateReset', () => {
  it('only checks the email', () => {
    expect(validateReset({ email: 'ana@ejemplo.com' })).toEqual({})
    expect(validateReset({ email: 'ana' })).toEqual({ email: 'authInvalidEmail' })
  })
})

describe('firstErrorField', () => {
  it('follows the order of the form', () => {
    expect(firstErrorField({ confirm: 'x', password: 'y' })).toBe('password')
    expect(firstErrorField({ confirm: 'x' })).toBe('confirm')
    expect(firstErrorField({ email: 'x', confirm: 'y' })).toBe('email')
    expect(firstErrorField({})).toBe(null)
  })
})

describe('runOnce', () => {
  it('ignores a second tap while the first is still running', async () => {
    const lock = { current: false }
    let calls = 0
    let finish
    const action = () => {
      calls += 1
      return new Promise((resolve) => {
        finish = resolve
      })
    }
    const first = runOnce(lock, action)
    const second = runOnce(lock, action)
    expect(await second).toBe(false)
    expect(calls).toBe(1)
    finish()
    expect(await first).toBe(true)
  })

  it('lets the form be sent again after it finishes, even with an error', async () => {
    const lock = { current: false }
    await expect(runOnce(lock, () => Promise.reject(new Error('x')))).rejects.toThrow('x')
    expect(lock.current).toBe(false)
    expect(await runOnce(lock, async () => {})).toBe(true)
  })
})

describe('safeRedirect', () => {
  it('goes back to the page of the app that was asked for', () => {
    expect(safeRedirect({ pathname: '/history', search: '?q=1', hash: '#x' })).toBe('/history?q=1#x')
    expect(safeRedirect({ pathname: '/edit/5' })).toBe('/edit/5')
  })

  it('goes to the start when there is no page or it is not safe', () => {
    expect(safeRedirect(undefined)).toBe('/')
    expect(safeRedirect({})).toBe('/')
    expect(safeRedirect('/history')).toBe('/')
    expect(safeRedirect({ pathname: 'https://otro.com' })).toBe('/')
    expect(safeRedirect({ pathname: '//otro.com' })).toBe('/')
    expect(safeRedirect({ pathname: '/\\otro.com' })).toBe('/')
  })

  it('never sends back to a sign-in page', () => {
    expect(safeRedirect({ pathname: '/login' })).toBe('/')
    expect(safeRedirect({ pathname: '/registro' })).toBe('/')
    expect(safeRedirect({ pathname: '/recuperar' })).toBe('/')
  })
})

describe('submitForm', () => {
  const errorKey = (error) => `key:${error.code}`
  const base = (overrides = {}) => ({
    lock: { current: false },
    values: { email: 'ana@ejemplo.com', password: 'x' },
    validate: validateSignIn,
    errorKey,
    ...overrides,
  })

  it('sends only once when "Entrar" is tapped twice quickly', async () => {
    let finish
    let calls = 0
    const send = () => {
      calls += 1
      return new Promise((resolve) => {
        finish = resolve
      })
    }
    const options = base({ send })
    const first = submitForm(options)
    const second = submitForm(options)
    expect(await second).toEqual({ ignored: true })
    finish()
    expect(await first).toEqual({ errors: {}, notice: null })
    expect(calls).toBe(1)
  })

  it('does not send when a field is wrong, and points at the first one', async () => {
    let calls = 0
    const onStart = () => {
      calls += 1
    }
    const result = await submitForm(
      base({ values: { email: 'ana', password: '' }, send: async () => {}, onStart }),
    )
    expect(result).toEqual({
      errors: { email: 'authInvalidEmail', password: 'authPasswordRequired' },
      first: 'email',
    })
    expect(calls).toBe(0)
  })

  it('turns a Firebase error into its key, never the raw message', async () => {
    const send = () =>
      Promise.reject(Object.assign(new Error('Firebase: secret text'), { code: 'auth/x' }))
    const result = await submitForm(base({ send }))
    expect(result).toEqual({ errors: {}, formError: 'key:auth/x', code: 'auth/x' })
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('returns the notice from send, and frees the lock after an error', async () => {
    const options = base({ send: () => Promise.reject(new Error('x')) })
    await submitForm(options)
    expect(options.lock.current).toBe(false)
    const ok = await submitForm({ ...options, send: async () => 'authResetSent' })
    expect(ok).toEqual({ errors: {}, notice: 'authResetSent' })
  })
})
