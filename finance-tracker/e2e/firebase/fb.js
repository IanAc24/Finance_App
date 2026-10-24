import { test as base, expect } from '@playwright/test'
import { readQaConfig } from '../../qa-firebase/lib/env.js'
import * as tracker from '../../qa-firebase/lib/tracker.js'
import { makeClient, taggedDocs } from '../../qa-firebase/lib/sdk.js'
import { addEntry, fillSignIn, open, passConsentAndWelcome } from '../support/app.js'

// Helpers of the real-Firebase browser specs (docs/qa/firebase-real.md).
// The app runs against the real test project in cloud mode; the tests sign
// in (never sign up) with accounts made by a person in the console.

export const ENABLED = process.env.QA_FIREBASE === '1'

let cached = null
// The validated settings (only read when the project is really running)
export function qa() {
  if (!cached) cached = readQaConfig()
  return cached
}

const ALLOWED_HOSTS = (host) =>
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === 'googleapis.com' ||
  host.endsWith('.googleapis.com') ||
  host.endsWith('.firebaseapp.com')

// Firestore's connection check loads this 1x1 image from www.google.com when
// the network comes back (seen in the offline test); only this exact URL
const ALLOWED_URL = (url) =>
  url.hostname === 'www.google.com' && url.pathname === '/images/cleardot.gif'

// Only the local app, Google APIs (Auth, Firestore) and the project's
// firebaseapp.com domain may be reached; anything else is blocked and recorded.
export async function lockNetwork(context, escaped) {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (ALLOWED_HOSTS(url.hostname) || ALLOWED_URL(url)) return route.continue()
    escaped.push(`${route.request().method()} ${url.origin}${url.pathname}`)
    return route.abort('blockedbyclient')
  })
}

export const test = base.extend({
  escaped: async ({}, use) => {
    await use([])
  },
  pageErrors: async ({}, use) => {
    await use([])
  },

  // a clean, locked context for each extra browser the test opens
  newContext: async ({ browser, baseURL, escaped, pageErrors }, use) => {
    const opened = []
    await use(async () => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 1280, height: 720 },
        locale: 'en-US',
        serviceWorkers: 'block',
      })
      await lockNetwork(context, escaped)
      context.on('page', (page) => page.on('pageerror', (e) => pageErrors.push(e.message)))
      opened.push(context)
      return context
    })
    for (const context of opened) await context.close()
  },

  // the default context/page, locked the same way
  context: async ({ context, escaped }, use) => {
    await lockNetwork(context, escaped)
    await use(context)
  },
  page: async ({ page, pageErrors }, use) => {
    page.on('pageerror', (e) => pageErrors.push(e.message))
    await use(page)
  },

  // sign-ins with the client SDK, to check what the SERVER really holds
  server: async ({}, use) => {
    const clients = new Map()
    await use({
      async client(n) {
        if (!clients.has(n)) {
          tracker.useAccount(qa().runId, n)
          clients.set(n, await makeClient(qa(), qa().account(n)))
        }
        return clients.get(n)
      },
      // tagged transactions of account n whose note starts with "<tag> <label>"
      async docs(n, label) {
        return taggedDocs(await this.client(n), 'transactions', `${qa().tag} ${label}`)
      },
      // tagged savings moves (their note starts with "<tag> <label>")
      async moves(n, label) {
        return taggedDocs(await this.client(n), 'savings', `${qa().tag} ${label}`)
      },
      // tagged savings goals (their NAME starts with "<tag> <label>")
      async goals(n, label) {
        return taggedDocs(await this.client(n), 'goals', `${qa().tag} ${label}`, 'name')
      },
    })
    for (const client of clients.values()) await client.close()
  },

  // runs after every test: nothing left the allowed hosts, no page error
  guard: [
    async ({ escaped, pageErrors }, use) => {
      await use()
      expect.soft(escaped, 'requests to hosts that are not localhost / googleapis / firebaseapp').toEqual([])
      expect.soft(pageErrors, 'uncaught errors in the page').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

// Skips the whole file unless the real project is active (QA_FIREBASE=1)
export function onlyWhenEnabled() {
  test.skip(!ENABLED, 'Real Firebase project: run it with npm run qa:firebase:e2e')
}

// Reserves `n` writes of QA_MAX_WRITES for a test, or skips it when they do not fit
export function reserveWrites(n) {
  const left = tracker.writesLeft(qa().runId)
  test.skip(left < n, `Write cap: ${n} writes needed, only ${left} left (QA_MAX_WRITES)`)
  tracker.countWrites(qa().runId, n)
}

export const noteFor = (label) => `${qa().tag} ${label}`

// Signs in (never signs up) as QA account n and gets through consent/welcome
export async function enterAs(page, n) {
  const { email, password } = qa().account(n)
  tracker.useAccount(qa().runId, n)
  await open(page, '/login')
  await fillSignIn(page, email, password)
  await passConsentAndWelcome(page)
}

// Adds a tagged expense through the screen: note "<tag> <label>"
export function addTagged(page, label, opts) {
  return addEntry(page, { ...opts, note: noteFor(label) })
}

// The History rows whose note starts with the run tag (and the label, if given)
export async function taggedRows(page, label = '') {
  const prefix = label ? noteFor(label) : qa().tag
  const rows = await page.locator('.hist-row').evaluateAll((els) =>
    els.map((r) => ({
      name: r.querySelector('.hist-row-name')?.textContent?.trim() ?? '',
      amount: r.querySelector('.hist-row-amount')?.textContent?.replace(/\s/g, ' ').trim() ?? '',
    })),
  )
  return rows.filter((r) => r.name.startsWith(prefix))
}

// "− ₡10.000" -> { currency: 'CRC', cents: 1000000 }; "− $0.10" -> { USD, 10 }
export function parseMoney(text) {
  // spaces (also thin / no-break) and the minus sign (hyphen or U+2212) are dropped
  const t = String(text).replace(/[\s\u2009\u00a0\u202f\u2212-]/g, '')
  if (t.startsWith('\u20a1')) return { currency: 'CRC', cents: Math.round(Number(t.slice(1).replace(/\./g, '').replace(',', '.')) * 100) }
  if (t.startsWith('$')) return { currency: 'USD', cents: Math.round(Number(t.slice(1).replace(/,/g, '')) * 100) }
  throw new Error(`Unrecognised amount: ${text}`)
}

export const sumCents = (rows, currency) =>
  rows.map((r) => parseMoney(r.amount)).filter((m) => m.currency === currency).reduce((s, m) => s + m.cents, 0)

// Polls the server (not the screen) until `check` accepts the documents
export async function waitForServer(server, n, label, check, timeout = 60_000) {
  await expect.poll(async () => check(await server.docs(n, label)), { timeout, intervals: [1000, 2000, 3000] }).toBe(true)
}
