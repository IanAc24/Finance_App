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

// Problems with how the app is connected to Firebase, not with the person:
// the message says what to fix instead of "something went wrong". Firebase
// builds some codes from the server text, so these are matched by prefix
// (a bad key gives "auth/api-key-not-valid.-please-pass-a-valid-api-key.").
const SETUP_PREFIXES = [
  ['auth/api-key-not-valid', 'authBadConfig'],
  ['auth/invalid-api-key', 'authBadConfig'],
  ['auth/project-not-found', 'authBadConfig'],
  ['auth/app-not-authorized', 'authBadConfig'],
  ['auth/requests-from-referer', 'authBadConfig'],
  ['auth/operation-not-allowed', 'authMethodDisabled'],
  ['auth/configuration-not-found', 'authMethodDisabled'],
  ['auth/admin-restricted-operation', 'authSignUpDisabled'],
]

export const UNKNOWN_ERROR = 'authUnknown'

export function authErrorKey(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  if (KEYS[code]) return KEYS[code]
  const setup = SETUP_PREFIXES.find(([prefix]) => code.startsWith(prefix))
  return setup ? setup[1] : UNKNOWN_ERROR
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
