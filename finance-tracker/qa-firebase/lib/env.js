import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Settings and safety guard of the real-Firebase QA suite. Nothing in this
// file touches the network: it only reads .env.qa.local (never .env.local)
// and refuses to go on unless everything is in order.

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const ENV_FILE = join(ROOT, '.env.qa.local')
export const RESULTS_DIR = join(ROOT, 'e2e', 'results')

export class QaGuardError extends Error {}

const CONFIG_VARS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}
export const MAX_ACCOUNTS = 15

// KEY=VALUE lines; # comments; optional single or double quotes
export function parseEnvFile(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

// Fills `env` from .env.qa.local. Variables already in the environment win.
// Returns true when the file exists.
export function loadQaEnv(env = process.env) {
  if (!existsSync(ENV_FILE)) return false
  const parsed = parseEnvFile(readFileSync(ENV_FILE, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] === undefined) env[key] = value
  }
  return true
}

// p***1@...  (never the whole address)
export function maskEmail(email) {
  const [local = '', domain] = String(email ?? '').split('@')
  if (!local || domain === undefined) return '(no email)'
  return `${local[0]}***${local.length > 1 ? local[local.length - 1] : ''}@…`
}

export const maskUid = (uid) => `${String(uid).slice(0, 5)}…`

// One id for the whole run (shared by the Vitest and Playwright processes)
export function ensureRunId(env = process.env) {
  const given = env.QA_RUN_ID?.trim()
  if (given) {
    if (!/^[A-Za-z0-9-]{3,30}$/.test(given)) {
      throw new QaGuardError('QA_RUN_ID must be 3-30 characters: letters, digits and "-".')
    }
    return given
  }
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const id = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  env.QA_RUN_ID = id
  return id
}

// The tag every document of this run carries in its note / name / qaTag
export const tagOf = (runId) => `QA-${runId}`

// Validates everything and returns the settings. Throws QaGuardError (with a
// message that is safe to print) when the run must not start.
export function readQaConfig(env = process.env) {
  const fileFound = loadQaEnv(env)

  const firebaseConfig = {}
  const missing = []
  for (const [field, name] of Object.entries(CONFIG_VARS)) {
    const value = env[name]?.trim()
    if (value) firebaseConfig[field] = value
    else missing.push(name)
  }
  if (missing.length) {
    throw new QaGuardError(
      `${fileFound ? '' : 'finance-tracker/.env.qa.local not found (copy .env.qa.example). '}` +
        `Missing: ${missing.join(', ')}. Nothing was contacted.`,
    )
  }

  const { projectId } = firebaseConfig
  if (projectId.startsWith('demo-')) {
    throw new QaGuardError(`The project id "${projectId}" is a fake demo id. Use the real test project. Nothing was contacted.`)
  }
  const allowed = env.QA_FIREBASE_ALLOW_PROJECT?.trim()
  if (!allowed) {
    throw new QaGuardError(
      `QA_FIREBASE_ALLOW_PROJECT is not set. To confirm you want to run against "${projectId}", ` +
        'set it to exactly that project id. Nothing was contacted.',
    )
  }
  if (allowed !== projectId) {
    throw new QaGuardError(
      `QA_FIREBASE_ALLOW_PROJECT ("${allowed}") does not match VITE_FIREBASE_PROJECT_ID ("${projectId}"). Nothing was contacted.`,
    )
  }

  const accounts = []
  for (let n = 1; n <= MAX_ACCOUNTS; n++) {
    const email = env[`QA_ACCOUNT_${n}_EMAIL`]?.trim()
    const password = env[`QA_ACCOUNT_${n}_PASSWORD`]
    if (email && password) accounts.push({ n, email, password })
  }
  if (accounts.length < 2) {
    throw new QaGuardError(
      `At least 2 accounts are needed (QA_ACCOUNT_1_* and QA_ACCOUNT_2_*), found ${accounts.length}. Nothing was contacted.`,
    )
  }

  const maxWrites = env.QA_MAX_WRITES?.trim() ? Number(env.QA_MAX_WRITES) : 1000
  if (!Number.isInteger(maxWrites) || maxWrites < 1) {
    throw new QaGuardError('QA_MAX_WRITES must be a positive whole number.')
  }

  const runId = ensureRunId(env)
  return {
    firebaseConfig,
    projectId,
    accounts,
    account: (n) => accounts.find((a) => a.n === n),
    maxWrites,
    runId,
    tag: tagOf(runId),
  }
}

// Prints the safe summary of a run (no secrets)
export function describeConfig(cfg) {
  return [
    `Firebase project: ${cfg.projectId}`,
    `Run id: ${cfg.runId}   tag: ${cfg.tag}`,
    `Accounts: ${cfg.accounts.map((a) => `#${a.n} ${maskEmail(a.email)}`).join(', ')}`,
    `Write cap: ${cfg.maxWrites}`,
  ].join('\n')
}
