import { QaGuardError, describeConfig, readQaConfig } from './lib/env.js'
import { initRun } from './lib/tracker.js'

// Runs before any test and before any network use: the safety guard.
export default function setup() {
  try {
    const cfg = readQaConfig()
    console.log(`\n[qa:firebase] ${describeConfig(cfg).replace(/\n/g, '\n[qa:firebase] ')}`)
    initRun(cfg)
  } catch (error) {
    if (error instanceof QaGuardError) {
      console.error(`\n[qa:firebase] REFUSED: ${error.message}\n`)
      process.exit(1)
    }
    throw error
  }
}
