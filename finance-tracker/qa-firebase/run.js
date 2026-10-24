// Entry point of `npm run qa:firebase[:rules|:e2e|:cleanup]`.
//
//   node qa-firebase/run.js rules     Vitest rules tests
//   node qa-firebase/run.js e2e       Playwright "firebase" project
//   node qa-firebase/run.js all       both (rules first)
//   node qa-firebase/run.js cleanup   remove what a previous run left behind
//
// It runs the safety guard FIRST (no network is touched before it passes),
// fixes one run id for the child processes, and at the end writes
// e2e/results/firebase-report.json (pass/fail per test, no secrets).

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { QaGuardError, RESULTS_DIR, ROOT, describeConfig, readQaConfig } from './lib/env.js'
import * as tracker from './lib/tracker.js'

const mode = process.argv[2] ?? 'all'
if (!['rules', 'e2e', 'all', 'cleanup'].includes(mode)) {
  console.error('Usage: node qa-firebase/run.js rules|e2e|all|cleanup')
  process.exit(2)
}

let cfg
try {
  cfg = readQaConfig()
} catch (error) {
  if (error instanceof QaGuardError) {
    console.error(`\n[qa:firebase] REFUSED: ${error.message}`)
    console.error('[qa:firebase] See docs/qa/firebase-real.md and finance-tracker/.env.qa.example.\n')
    process.exit(1)
  }
  throw error
}

console.log(`\n[qa:firebase] mode: ${mode}\n${describeConfig(cfg)}\n`)
mkdirSync(RESULTS_DIR, { recursive: true })

const childEnv = { ...process.env, QA_RUN_ID: cfg.runId, QA_FIREBASE: '1' }
const run = (args) => spawnSync(process.execPath, args, { cwd: ROOT, env: childEnv, stdio: 'inherit' }).status ?? 1

async function cleanup() {
  // a manifest left by an earlier run: use its run id, not the new one
  const left = tracker.snapshot()
  if (!left) {
    console.log('[qa:firebase] No manifest found: nothing to clean.')
    return 0
  }
  if (left.projectId !== cfg.projectId) {
    console.error(`[qa:firebase] The manifest belongs to project "${left.projectId}", not "${cfg.projectId}". Refusing.`)
    return 1
  }
  const { teardown } = await import('./lib/sdk.js')
  const result = await teardown({ ...cfg, runId: left.runId, tag: `QA-${left.runId}` })
  return result.failures.length ? 1 : 0
}

function collectPlaywright(node, out = [], path = []) {
  const here = node.title && !node.file ? [...path, node.title] : path
  for (const spec of node.specs ?? []) {
    const result = spec.tests?.[0]?.results?.at(-1)
    out.push({
      suite: 'e2e',
      name: [...here, spec.title].join(' > '),
      status: spec.tests?.[0]?.status === 'skipped' ? 'skipped' : spec.ok ? 'passed' : 'failed',
      durationMs: result?.duration ?? 0,
    })
  }
  for (const child of node.suites ?? []) collectPlaywright(child, out, here)
  return out
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function buildReport(exitCodes) {
  const tests = []
  const rules = readJson(join(RESULTS_DIR, 'firebase-rules.json'))
  for (const file of rules?.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      tests.push({ suite: 'rules', name: t.fullName ?? t.title, status: t.status, durationMs: t.duration ?? 0 })
    }
  }
  const e2e = readJson(join(RESULTS_DIR, 'firebase-e2e.json'))
  for (const suite of e2e?.suites ?? []) collectPlaywright(suite, tests)
  const manifest = tracker.snapshot()
  const count = (s) => tests.filter((t) => t.status === s).length
  return {
    runId: cfg.runId,
    projectId: cfg.projectId,
    mode,
    finishedAt: new Date().toISOString(),
    exitCodes,
    writes: { used: manifest?.writes ?? 0, cap: cfg.maxWrites, deletedByTeardown: manifest?.deletes ?? 0 },
    leftoverDocuments: manifest?.docs ?? [],
    summary: { total: tests.length, passed: count('passed'), failed: count('failed'), skipped: count('skipped') },
    knownGaps: manifest?.gaps ?? [],
    tests,
  }
}

let code
if (mode === 'cleanup') {
  code = await cleanup()
} else {
  tracker.initRun(cfg)
  const exitCodes = {}
  if (mode === 'rules' || mode === 'all') {
    exitCodes.rules = run(['node_modules/vitest/vitest.mjs', 'run', '-c', 'vitest.firebase.config.js'])
  }
  if (mode === 'e2e' || mode === 'all') {
    exitCodes.e2e = run(['node_modules/@playwright/test/cli.js', 'test', '--project=firebase'])
  }
  const report = buildReport(exitCodes)
  const file = join(RESULTS_DIR, 'firebase-report.json')
  writeFileSync(file, JSON.stringify(report, null, 2))
  const { summary, writes } = report
  console.log(
    `\n[qa:firebase] run ${cfg.runId} on ${cfg.projectId}: ${summary.passed} passed, ${summary.failed} failed, ` +
      `${summary.skipped} skipped. Writes used: ${writes.used} of ${writes.cap} ` +
      `(${writes.deletedByTeardown} were cleanup deletions).`,
  )
  if (report.leftoverDocuments.length) {
    console.log(`[qa:firebase] ${report.leftoverDocuments.length} document(s) could not be removed: run "npm run qa:firebase:cleanup".`)
  }
  console.log(`[qa:firebase] Report: ${existsSync(file) ? file : '(not written)'}\n`)
  code = Object.values(exitCodes).some((c) => c !== 0) ? 1 : 0
}
process.exit(code)
