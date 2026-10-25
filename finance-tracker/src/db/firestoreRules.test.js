import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { categoryColors } from '../lib/categories'
import { INCOME_SOURCES } from '../lib/income'
import {
  MAX_CATEGORY_NAME_LENGTH,
  MAX_GOAL_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_PROFILE_NAME_LENGTH,
} from '../lib/limits'
import { MAX_CENTS, currencies } from '../lib/money'
import { paymentMethods } from '../lib/payment'
import { DEFAULT_SCHEDULE, MAX_SCHEDULE_ENTRIES } from '../lib/quincenaSchedule'
import { schedules } from '../lib/recurring'
import { MAX_YEAR, MIN_YEAR } from '../lib/dates'
import {
  budgetData,
  categoryData,
  goalData,
  newRecurringData,
  profileData,
  savingsData,
  scheduleData,
  transactionData,
} from './cloudData'

// Guards against drift between firestore.rules and the app, with no network:
// it reads the text of the rules and compares it with what the app writes
// (the builders of cloudData.js) and with the constants of src/lib. It does not
// run the rules; that is what `npm run qa:firebase:rules` does against the
// real project (ficha 007).

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const rules = read('../../firestore.rules')
const cloudSource = read('./cloudStorage.js')

// The text of one `function name(...) { ... }` of the rules (up to the next one)
function functionBody(name) {
  const start = rules.indexOf(`function ${name}(`)
  expect(start, `function ${name} is missing from firestore.rules`).toBeGreaterThan(-1)
  const next = rules.indexOf('\n    function ', start + 1)
  const end = next === -1 ? rules.indexOf('// --- The paths', start) : next
  return rules.slice(start, end === -1 ? undefined : end)
}

// ['a', 'b'] of the first `.keys().<method>([...])` of a function
function keyList(name, method) {
  const body = functionBody(name)
  const match = new RegExp(`\\.keys\\(\\)\\.${method}\\(\\[([^\\]]*)\\]\\)`).exec(body)
  expect(match, `${name} has no ${method} list`).not.toBeNull()
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('firestore.rules: the collections', () => {
  const used = new Set([...cloudSource.matchAll(/(?:listOf|itemOf)\('(\w+)'/g)].map((m) => m[1]))
  used.add('meta') // metaOf() is always meta/<name>
  const allowed = new Set([...rules.matchAll(/match \/users\/\{uid\}\/(\w+)\//g)].map((m) => m[1]))

  it('names every collection the cloud store uses', () => {
    expect([...used].sort()).toEqual(
      ['budgets', 'categories', 'goals', 'meta', 'recurring', 'savings', 'transactions'],
    )
    for (const name of used) expect(allowed.has(name), name).toBe(true)
  })

  it('allows no collection the cloud store does not use', () => {
    for (const name of allowed) expect(used.has(name), name).toBe(true)
  })

  it('has only the two meta documents the app writes', () => {
    const metaNames = [...cloudSource.matchAll(/metaOf\('(\w+)'\)/g)].map((m) => m[1])
    expect([...new Set(metaNames)].sort()).toEqual(['profile', 'schedule'])
    const paths = [...rules.matchAll(/match \/users\/\{uid\}\/meta\/(\{?\w+\}?)/g)].map((m) => m[1])
    expect(paths.sort()).toEqual(['profile', 'schedule'])
  })

  it('keeps the catch-all deny', () => {
    expect(rules).toMatch(/match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/)
  })

  it('reads and deletes for the owner only, and validates every create and update', () => {
    const blocks = rules.split('\n    match /users/').slice(1)
    expect(blocks).toHaveLength(8)
    for (const block of blocks) {
      expect(block).toMatch(/allow read, delete: if isOwner\(uid\);/)
      expect(block).toMatch(/allow create, update: if isOwner\(uid\)[\s\S]*valid\w+\(request\.resource\.data\)/)
    }
  })
})

// Every key a builder writes must be allowed, and every key the rules require
// must be written. `samples` are real builder outputs.
function expectKeys(fn, samples) {
  const only = keyList(fn, 'hasOnly')
  const all = keyList(fn, 'hasAll')
  const written = new Set()
  for (const sample of samples) {
    const keys = Object.keys(sample)
    for (const key of keys) {
      written.add(key)
      expect(only, `${fn}: the app writes "${key}"`).toContain(key)
    }
    for (const key of all) expect(keys, `${fn}: "${key}" is required but not written`).toContain(key)
  }
  // an allowed key nobody writes is a leftover
  for (const key of only) expect([...written], `${fn}: "${key}" is never written`).toContain(key)
  for (const key of all) expect(only).toContain(key)
}

describe('firestore.rules: the fields the app writes', () => {
  const tx = { amount: 10, currency: 'CRC', type: 'expense', date: '2026-10-25' }
  const item = { amount: 10, currency: 'USD', type: 'expense', schedule: 'every' }

  it('transactions (an income carries a source, an expense does not)', () => {
    expectKeys('validTransaction', [
      transactionData(tx),
      transactionData({ ...tx, type: 'income', source: 'salary' }),
    ])
    expect(Object.keys(transactionData(tx))).not.toContain('source')
  })

  it('categories', () => {
    expectKeys('validCategory', [categoryData({ id: 1, name: 'Pets', color: 'cyan' })])
  })

  it('budgets', () => {
    expectKeys('validBudget', [budgetData(7, 'CRC', 5000)])
  })

  it('recurring', () => {
    expectKeys('validRecurring', [newRecurringData(item)])
  })

  it('savings', () => {
    expectKeys('validSavings', [savingsData({ ...tx, direction: 'in' })])
  })

  it('goals', () => {
    expectKeys('validGoal', [
      goalData({ name: 'Trip', target: 100, currency: 'USD', createdAt: '2026-10-25' }),
    ])
  })

  it('meta/profile', () => {
    expectKeys('validProfile', [profileData({ name: 'Ian', income: 100, currency: 'CRC' })])
  })

  it('meta/schedule', () => {
    expectKeys('validSchedule', [scheduleData(DEFAULT_SCHEDULE)])
    expectKeys('validScheduleEntry', scheduleData(DEFAULT_SCHEDULE).entries)
    expectKeys('validScheduleEntry', scheduleData([
      { from: '2026-01-01', mode: 'paydays', day1: 5, day2: null },
      { from: '2026-02-01', mode: 'manual' },
    ]).entries)
  })
})

describe('firestore.rules: the values the app uses', () => {
  const listOf = (fn, field) => {
    const body = functionBody(fn)
    const match = new RegExp(`${field} in \\[([^\\]]*)\\]`).exec(body)
    expect(match, `${fn}.${field} has no list`).not.toBeNull()
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  }

  it('currencies, payment methods, schedules, sources and colors', () => {
    expect(listOf('validCurrency', 'v').sort()).toEqual(currencies.map((c) => c.code).sort())
    expect(listOf('validTransaction', 'd.paymentMethod').sort()).toEqual(
      paymentMethods.map((m) => m.code).sort(),
    )
    expect(listOf('validRecurring', 'd.schedule').sort()).toEqual([...schedules].sort())
    expect(listOf('validTransaction', 'd.source').sort()).toEqual([...INCOME_SOURCES].sort())
    expect(listOf('validCategory', 'd.color').sort()).toEqual([...categoryColors].sort())
    expect(listOf('validTransaction', 'd.type').sort()).toEqual(['expense', 'income'])
    expect(listOf('validSavings', 'd.direction').sort()).toEqual(['in', 'out'])
  })

  it('the limits of src/lib', () => {
    // notes and category names are counted in characters by the app: the rules
    // allow double so size() can never refuse an emoji (see the header of the rules)
    expect(functionBody('validNote')).toContain(`size() <= ${MAX_NOTE_LENGTH * 2}`)
    expect(functionBody('validCategory')).toContain(`size() <= ${MAX_CATEGORY_NAME_LENGTH * 2}`)
    expect(functionBody('validGoal')).toContain(`size() <= ${MAX_GOAL_NAME_LENGTH}`)
    expect(functionBody('validProfile')).toContain(`size() <= ${MAX_PROFILE_NAME_LENGTH}`)
    expect(functionBody('validCents')).toContain(`v <= ${MAX_CENTS}`)
    expect(functionBody('validSchedule')).toContain(`size() <= ${MAX_SCHEDULE_ENTRIES}`)
    expect(functionBody('validDate')).toContain(`2100`)
    expect(MIN_YEAR).toBe(2000)
    expect(MAX_YEAR).toBe(2100)
  })

  it('the name of a budget document', () => {
    expect(rules).toContain('_(CRC|USD)$')
  })
})
