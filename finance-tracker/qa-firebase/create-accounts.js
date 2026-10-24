// Creates the QA test accounts (pruebacorreo1..N@example.test) in a REAL
// Firebase project and saves their passwords in .env.qa.local, which git
// ignores. Meant to be run by a person:
//
//   npm run qa:firebase:accounts -- --project <projectId> [--count 15]
//
// It reads the Firebase web config from .env.qa.local, or from .env.local
// the first time, and refuses to run unless --project equals that config's
// projectId. Passwords are generated here and never printed. Accounts that
// already exist are left alone. It never deletes accounts.

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { ENV_FILE, MAX_ACCOUNTS, ROOT, parseEnvFile } from './lib/env.js'

const CONFIG_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]
const APP_ENV_FILE = join(ROOT, '.env.local')

function fail(message) {
  console.error(`\n✖ ${message}\nNothing was created.\n`)
  process.exit(1)
}

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : undefined
}

const readEnv = (file) =>
  existsSync(file) ? parseEnvFile(readFileSync(file, 'utf8')) : {}

// A long random password that also meets common policies
const newPassword = () => `${randomBytes(18).toString('base64url')}Aa9!`

// Writes KEY=VALUE pairs into .env.qa.local, keeping the lines already there
function saveEnv(values) {
  const lines = existsSync(ENV_FILE)
    ? readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)
    : ['# Made by qa:firebase:accounts. Ignored by git: never commit it.']
  const pending = new Map(Object.entries(values))
  const out = lines.map((line) => {
    const key = line.split('=')[0].trim()
    if (pending.has(key)) {
      const value = pending.get(key)
      pending.delete(key)
      return `${key}=${value}`
    }
    return line
  })
  for (const [key, value] of pending) out.push(`${key}=${value}`)
  writeFileSync(ENV_FILE, `${out.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 })
}

async function main() {
  const qaEnv = readEnv(ENV_FILE)
  const appEnv = readEnv(APP_ENV_FILE)
  const config = {}
  for (const key of CONFIG_KEYS) {
    const value = qaEnv[key] || appEnv[key]
    if (!value) fail(`${key} is missing: put the Firebase web config in .env.qa.local or .env.local.`)
    config[key] = value
  }
  const projectId = config.VITE_FIREBASE_PROJECT_ID

  const wanted = argValue('--project')
  if (!wanted) fail(`Say which project to use: --project ${projectId}`)
  if (wanted !== projectId) {
    fail(`--project "${wanted}" does not match the configured project "${projectId}".`)
  }

  const count = Number(argValue('--count') ?? MAX_ACCOUNTS)
  if (!Number.isInteger(count) || count < 2 || count > MAX_ACCOUNTS) {
    fail(`--count must be a whole number from 2 to ${MAX_ACCOUNTS}.`)
  }

  console.log(`\nProject: ${projectId}`)
  console.log(`Accounts: pruebacorreo1..${count}@example.test\n`)

  const app = initializeApp({
    apiKey: config.VITE_FIREBASE_API_KEY,
    authDomain: config.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    appId: config.VITE_FIREBASE_APP_ID,
  })
  const auth = getAuth(app)

  // the suite reads the config and the lock from .env.qa.local
  const toSave = { ...Object.fromEntries(CONFIG_KEYS.map((k) => [k, config[k]])) }
  toSave.QA_FIREBASE_ALLOW_PROJECT = projectId

  const rows = []
  for (let i = 1; i <= count; i++) {
    const email = `pruebacorreo${i}@example.test`
    const savedPassword =
      qaEnv[`QA_ACCOUNT_${i}_EMAIL`] === email ? qaEnv[`QA_ACCOUNT_${i}_PASSWORD`] : ''
    try {
      if (savedPassword) {
        // already made by an earlier run: check the saved password still works
        const { user } = await signInWithEmailAndPassword(auth, email, savedPassword)
        rows.push({ i, email, uid: user.uid, status: 'already existed (password works)' })
      } else {
        const password = newPassword()
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        toSave[`QA_ACCOUNT_${i}_EMAIL`] = email
        toSave[`QA_ACCOUNT_${i}_PASSWORD`] = password
        rows.push({ i, email, uid: user.uid, status: 'created' })
      }
      await signOut(auth)
    } catch (error) {
      const code = error?.code ?? 'unknown'
      const status =
        code === 'auth/email-already-in-use'
          ? 'exists but its password is not in .env.qa.local (reset or delete it in the console)'
          : `failed: ${code}`
      rows.push({ i, email, uid: '-', status })
      if (code === 'auth/operation-not-allowed') {
        console.error('Email/Password sign-in is turned off in this project.')
        break
      }
      if (code === 'auth/too-many-requests') {
        console.error('Firebase is limiting requests: wait a few minutes and run this again.')
        break
      }
    }
  }

  saveEnv(toSave)

  for (const row of rows) {
    console.log(`${String(row.i).padStart(2)}  ${row.email.padEnd(32)} ${row.uid.padEnd(30)} ${row.status}`)
  }
  const ready = rows.filter((r) => r.uid !== '-').length
  console.log(`\n${ready} of ${count} accounts ready. Passwords are in .env.qa.local (not printed, ignored by git).`)
  console.log('They appear in the Firebase console under Authentication > Users.')
  if (ready < 2) process.exitCode = 1
  process.exit()
}

main().catch((error) => fail(`Unexpected error: ${error?.code ?? error?.message ?? error}`))
