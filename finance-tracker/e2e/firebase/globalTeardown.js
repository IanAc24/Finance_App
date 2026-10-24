import { readQaConfig } from '../../qa-firebase/lib/env.js'
import { snapshot } from '../../qa-firebase/lib/tracker.js'
import { teardown } from '../../qa-firebase/lib/sdk.js'

// Removes only what this run created (documents of the manifest and the notes
// that start with the run tag), signing in as the same test accounts.
export default async function globalTeardown() {
  const cfg = readQaConfig()
  const result = await teardown(cfg, (line) => console.log(`[qa:firebase] ${line}`))
  console.log(`[qa:firebase] Writes used this run: ${snapshot()?.writes} of ${cfg.maxWrites}`)
  if (result.failures.length) {
    throw new Error('Teardown could not remove everything: run "npm run qa:firebase:cleanup".')
  }
}
