import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESULTS_DIR } from './env.js'

// The record of a run: how many writes were spent, which documents were
// created (so teardown can remove exactly those) and what the "known gap"
// probes found. It lives in e2e/results/firebase-manifest.json (no
// passwords, no tokens) and is re-read before every change, because the
// Vitest process, the Playwright runner and its workers all use it.

export const MANIFEST = join(RESULTS_DIR, 'firebase-manifest.json')

export class WriteCapError extends Error {}

function read() {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'))
  } catch {
    return null
  }
}

function write(state) {
  mkdirSync(RESULTS_DIR, { recursive: true })
  writeFileSync(MANIFEST, JSON.stringify(state, null, 2))
}

function change(runId, fn) {
  const state = read()
  if (!state || state.runId !== runId) throw new Error('The run manifest is missing: start the run with initRun().')
  const result = fn(state)
  write(state)
  return result
}

// Starts (or continues) the manifest of this run. A manifest left by a
// different run is kept next to it, never overwritten, so its documents can
// still be removed with `npm run qa:firebase:cleanup`.
export function initRun({ runId, projectId, maxWrites }) {
  const existing = read()
  if (existing && existing.runId === runId) {
    existing.maxWrites = maxWrites
    write(existing)
    return existing
  }
  if (existing && (existing.docs?.length ?? 0) > 0) {
    renameSync(MANIFEST, join(RESULTS_DIR, `firebase-manifest.stale-${existing.runId}.json`))
  }
  const state = {
    runId,
    projectId,
    startedAt: new Date().toISOString(),
    maxWrites,
    writes: 0,
    deletes: 0,
    nextSeq: 1,
    accounts: [],
    docs: [],
    gaps: [],
  }
  write(state)
  return state
}

export const snapshot = () => read()

export function writesLeft(runId) {
  const s = read()
  return s && s.runId === runId ? s.maxWrites - s.writes : 0
}

// Reserves `n` writes of the cap; throws WriteCapError if they do not fit.
export function countWrites(runId, n = 1) {
  return change(runId, (s) => {
    if (s.writes + n > s.maxWrites) {
      throw new WriteCapError(
        `QA_MAX_WRITES (${s.maxWrites}) would be exceeded: ${s.writes} used, ${n} more requested.`,
      )
    }
    s.writes += n
    return s.maxWrites - s.writes
  })
}

// Cleanup deletions are counted but never blocked by the cap
export function countDeletes(runId, n) {
  change(runId, (s) => {
    s.deletes += n
    s.writes += n
  })
}

export function useAccount(runId, n) {
  change(runId, (s) => {
    if (!s.accounts.includes(n)) s.accounts.push(n)
  })
}

// Registers a document (any collection of the account: transactions, savings,
// goals...) BEFORE it is written, so even a write that fails
// halfway is cleaned up. `n` is the account that owns the path (and so the
// one that signs in to delete it).
export function track(runId, n, collection, id) {
  change(runId, (s) => {
    if (!s.accounts.includes(n)) s.accounts.push(n)
    if (!s.docs.some((d) => d.n === n && d.collection === collection && d.id === String(id))) {
      s.docs.push({ n, collection, id: String(id) })
    }
  })
}

export function untrack(runId, n, collection, id) {
  change(runId, (s) => {
    s.docs = s.docs.filter((d) => !(d.n === n && d.collection === collection && d.id === String(id)))
  })
}

export function recordGap(runId, name, outcome) {
  change(runId, (s) => {
    s.gaps = s.gaps.filter((g) => g.name !== name)
    s.gaps.push({ name, outcome })
  })
}

// Numeric document ids that cannot clash with the app's own (ids made from the
// clock times 1000, about 1.7e15): 9 + six digits of the run + a counter.
// Numeric on purpose, so the app can read them if one is ever left behind.
export function newDocId(runId) {
  return change(runId, (s) => `${idPrefix(runId)}${String(s.nextSeq++).padStart(8, '0')}`)
}

// The start of every id of this run ('9' + six digits of the run id). A document
// without a tag field (a budget has none) is recognised as the run's by it.
export function idPrefix(runId) {
  const digits = String(
    parseInt(createHash('sha1').update(runId).digest('hex').slice(0, 8), 16) % 1_000_000,
  ).padStart(6, '0')
  return `9${digits}`
}

export function hasManifest() {
  return existsSync(MANIFEST)
}
