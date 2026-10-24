import { RESET_SENT, resetResultKey } from './authErrors'

// Checks for the sign-in, sign-up and password recovery forms, done before
// anything is sent to Firebase. Each returns { field: translationKey } with
// only the fields that are wrong.

export const MIN_PASSWORD_LENGTH = 8

// something@something.something, without spaces
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(text) {
  return EMAIL.test(String(text ?? '').trim())
}

function checkEmail(email, errors) {
  if (!isValidEmail(email)) errors.email = 'authInvalidEmail'
}

export function validateSignIn({ email, password }) {
  const errors = {}
  checkEmail(email, errors)
  if (!password) errors.password = 'authPasswordRequired'
  return errors
}

// Passwords are never trimmed: a space is a valid character
export function validateSignUp({ email, password, confirm }) {
  const errors = {}
  checkEmail(email, errors)
  if ((password ?? '').length < MIN_PASSWORD_LENGTH) {
    errors.password = 'authPasswordTooShort'
  }
  if (confirm !== password) errors.confirm = 'authPasswordMismatch'
  return errors
}

export function validateReset({ email }) {
  const errors = {}
  checkEmail(email, errors)
  return errors
}

// Fields in the order they appear on screen, so focus goes to the first error
const FIELD_ORDER = ['email', 'password', 'confirm']

export function firstErrorField(errors) {
  return FIELD_ORDER.find((field) => errors[field]) ?? null
}

// Runs the action only if no other one is running on the same lock (a
// useRef), so two quick taps never send the form twice. Returns false when
// the tap was ignored.
export async function runOnce(lock, action) {
  if (lock.current) return false
  lock.current = true
  try {
    await action()
    return true
  } finally {
    lock.current = false
  }
}

// One send of a sign-in form: check the fields, then call Firebase. Returns
// what the screen must show:
//   { ignored: true }       another send was still running (double tap)
//   { errors, first }       a field is wrong; nothing was sent
//   { notice }              it worked (notice is a key or null)
//   { formError }           Firebase said no (a translation key)
// `onStart` runs once the fields are fine, right before sending.
export async function submitForm({ lock, values, validate, send, errorKey, onStart }) {
  let result = { ignored: true }
  await runOnce(lock, async () => {
    const errors = validate(values)
    const first = firstErrorField(errors)
    if (first) {
      result = { errors, first }
      return
    }
    onStart?.()
    try {
      result = { errors: {}, notice: (await send()) ?? null }
    } catch (error) {
      result = { errors: {}, formError: errorKey(error), code: error?.code ?? 'unknown' }
    }
  })
  return result
}

// Asks for the reset link and always answers "if the email is registered,
// we sent a link", so nobody can find out which emails have an account.
// Problems that are not about the account (no connection, too many
// attempts) are thrown so the form shows them.
export async function requestReset(resetPassword, email) {
  try {
    await resetPassword(email)
  } catch (error) {
    if (resetResultKey(error) !== RESET_SENT) throw error
  }
  return RESET_SENT
}

export const AUTH_PATHS = ['/login', '/registro', '/recuperar']

// Where to go after signing in: the page that sent the person to /login, if
// it is a page of this app. Anything else (another site, an auth page) goes
// to the start.
export function safeRedirect(from) {
  const pathname = from?.pathname
  if (typeof pathname !== 'string') return '/'
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/'
  if (pathname.includes('\\')) return '/'
  if (AUTH_PATHS.includes(pathname)) return '/'
  return `${pathname}${from.search ?? ''}${from.hash ?? ''}`
}
