import { defineConfig } from 'vitest/config'

// Rules tests against the REAL Firebase project (see docs/qa/firebase-real.md).
// Not part of `npm test`: run with `npm run qa:firebase:rules`.
export default defineConfig({
  test: {
    include: ['qa-firebase/**/*.test.js'],
    environment: 'node',
    globalSetup: ['./qa-firebase/globalSetup.js'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
    reporters: ['default', 'json'],
    outputFile: { json: 'e2e/results/firebase-rules.json' },
  },
})
