import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { manifest } from './accounts.js'

// Writes e2e/results/manifest.json (accounts -> scenarios, run id; no
// passwords) and fixes the run id for every worker of this run.
export default function globalSetup() {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'results')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify(manifest(), null, 2))
}
