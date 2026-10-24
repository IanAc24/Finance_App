// Turns a Firebase Authentication error into a translation key, so the raw
// error.message (in English, and sometimes with the email in it) is never
// shown. Codes from AuthErrorCodes in firebase/auth.

// A wrong password and an email with no account get the same message, so the
// sign-in form does not tell anyone which emails are registered
const WRONG_CREDENTIALS = 'authWrongCredentials'

const KEYS = {
  'auth/invalid-credential': WRONG_CREDENTIALS,
  'auth/wrong-password': WRONG_CREDENTIALS,
  'auth/user-not-found': WRONG_CREDENTIALS,
  'auth/user-disabled': WRONG_CREDENTIALS,
  'auth/invalid-email': 'authInvalidEmail',
  'auth/email-already-in-use': 'authEmailInUse',
  'auth/weak-password': 'authPasswordTooShort',
  'auth/too-many-requests': 'authTooManyAttempts',
  'auth/network-request-failed': 'authOffline',
}

export const UNKNOWN_ERROR = 'authUnknown'

export function authErrorKey(error) {
  return KEYS[error?.code] ?? UNKNOWN_ERROR
}

// Codes that would say whether an email has an account
const ACCOUNT_CODES = new Set([
  'auth/user-not-found',
  'auth/user-disabled',
  'auth/invalid-email',
  'auth/invalid-credential',
])

export const RESET_SENT = 'authResetSent'

// Recovering a password always says "if the email is registered, we sent a
// link", whether it exists or not. Only problems that are not about the
// account (no connection, too many attempts) get their own message.
export function resetResultKey(error) {
  if (!error || ACCOUNT_CODES.has(error.code)) return RESET_SENT
  return authErrorKey(error)
}
