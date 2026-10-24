import { QaGuardError, describeConfig, readQaConfig } from '../../qa-firebase/lib/env.js'
import { initRun } from '../../qa-firebase/lib/tracker.js'

// Real-Firebase project: the safety guard runs before the app is even served
export default function globalSetup() {
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
