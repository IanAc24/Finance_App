import { randomBytes } from 'node:crypto'
import { SEED, makeRng, pick } from './seed.js'
import { SCENARIOS_D } from './scenariosD.js'

// Fifteen QA accounts: pruebacorreo1..15@example.test. Passwords are made at
// run time from the seed plus a random salt that lives only in memory: they
// are never written to disk and never printed (use mask() in logs).
const SALT = randomBytes(16).toString('hex')

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!#$%&*+-?'

export const ACCOUNT_COUNT = 15

// what each account is used for (written to the manifest, no passwords)
export const SCENARIOS = {
  1: ['successful registration'],
  2: ['login and logout'],
  3: ['wrong password'],
  4: ['invalid email format (client and server)'],
  5: ['duplicate registration'],
  6: ['weak password (client and server)'],
  7: ['session persistence after reload'],
  8: ['expired session (token refresh fails)'],
  9: ['invalid session (account gone or disabled on the server)'],
  10: ['password reset for an existing email'],
  11: ['password reset for an unknown email (never registered)'],
  12: ['protected screens while logged out'],
  13: ['Spanish interface: sign up, sign in, errors'],
  14: ['sign out from Settings, back button after sign out'],
  15: ['return to the page asked for after signing in'],
}

export function email(n) {
  return `pruebacorreo${n}@example.test`
}

export function label(n) {
  return `pruebacorreo${n}`
}

export function password(n) {
  const rng = makeRng(`password:${n}:${SALT}`)
  const chars = [pick(rng, UPPER), pick(rng, LOWER), pick(rng, DIGITS), pick(rng, SYMBOLS)]
  const all = LOWER + UPPER + DIGITS
  while (chars.length < 14) chars.push(pick(rng, all))
  // deterministic shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

// A different password of the same strength, for the "wrong password" case
export function otherPassword(n) {
  return password(n + 1000)
}

export function account(n) {
  return { n, label: label(n), email: email(n), password: password(n) }
}

// for logs: never the password itself
export function mask(secret) {
  return secret ? `****(${String(secret).length})` : '(empty)'
}

export function runId() {
  if (!process.env.QA_RUN_ID) {
    process.env.QA_RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')
  }
  return process.env.QA_RUN_ID
}

export function manifest() {
  return {
    runId: runId(),
    seed: SEED,
    note: 'Passwords are generated in memory at run time and are not stored.',
    accounts: Array.from({ length: ACCOUNT_COUNT }, (_, i) => ({
      label: label(i + 1),
      email: email(i + 1),
      scenarios: [...SCENARIOS[i + 1], ...(SCENARIOS_D[i + 1] ?? [])],
    })),
  }
}
