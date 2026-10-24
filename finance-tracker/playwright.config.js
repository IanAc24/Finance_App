import { defineConfig } from '@playwright/test'
import { QaGuardError, loadQaEnv, readQaConfig } from './qa-firebase/lib/env.js'

// Browser tests (see e2e/). The app runs against a FAKE Firebase web config
// (no real project, no secrets) and keeps its data in the browser (local
// SQLite). Every Google request is answered by the in-test fake in
// e2e/support/fakeAuth.js; nothing reaches the internet.
const PORT = 5300

// --- Real Firebase project (docs/qa/firebase-real.md) ---------------------
// A separate project, "firebase", for e2e/firebase/*.spec.js. It is only ACTIVE
// when QA_FIREBASE=1 (set by `npm run qa:firebase:e2e`); `--project=firebase`
// without it just lets Playwright LIST the specs, and they skip themselves.
// In that mode the fake-auth projects below are not defined, and the app is
// served against the real project from .env.qa.local (cloud data).
const FB_PORT = 5301
const FB_ACTIVE = process.env.QA_FIREBASE === '1'
const FB_LISTING = !FB_ACTIVE && process.argv.some((a) => a === 'firebase' || a === '--project=firebase')
const FB_MODE = FB_ACTIVE || FB_LISTING

let fbEnv = {}
if (FB_ACTIVE) {
  try {
    const cfg = readQaConfig()
    fbEnv = {
      VITE_FIREBASE_API_KEY: cfg.firebaseConfig.apiKey,
      VITE_FIREBASE_AUTH_DOMAIN: cfg.firebaseConfig.authDomain,
      VITE_FIREBASE_PROJECT_ID: cfg.firebaseConfig.projectId,
      VITE_FIREBASE_APP_ID: cfg.firebaseConfig.appId,
      // empty would mean cloud too; an explicit value cannot be overridden by .env.local
      VITE_DATA_BACKEND: 'cloud',
      // tests only sign in, never sign up
      VITE_ALLOW_SIGNUP: '0',
    }
  } catch (error) {
    if (error instanceof QaGuardError) {
      console.error(`[qa:firebase] REFUSED: ${error.message}`)
      process.exit(1)
    }
    throw error
  }
} else if (FB_LISTING) {
  loadQaEnv()
}

export default defineConfig(FB_MODE ? {
  testDir: 'e2e',
  testMatch: '**/firebase/**/*.spec.js',
  outputDir: 'e2e/results/artifacts-firebase',
  globalSetup: FB_ACTIVE ? './e2e/firebase/globalSetup.js' : undefined,
  globalTeardown: FB_ACTIVE ? './e2e/firebase/globalTeardown.js' : undefined,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/results/firebase-e2e.json' }],
    ['html', { outputFolder: 'e2e/results/html-firebase', open: 'never' }],
  ],
  use: {
    baseURL: `http://localhost:${FB_PORT}`,
    channel: 'msedge',
    headless: true,
    locale: 'en-US',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'firebase', use: { viewport: { width: 1280, height: 720 } } }],
  webServer: FB_ACTIVE
    ? {
        command: `npm run dev -- --port ${FB_PORT} --strictPort`,
        url: `http://localhost:${FB_PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: fbEnv,
      }
    : undefined,
} : {
  testDir: 'e2e',
  testMatch: '**/*.spec.js',
  outputDir: 'e2e/results/artifacts',
  globalSetup: './e2e/support/globalSetup.js',
  // the app allows one tab per database origin
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/results/results.json' }],
    ['html', { outputFolder: 'e2e/results/html', open: 'never' }],
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'msedge',
    headless: true,
    locale: 'en-US',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', testIgnore: '**/firebase/**', use: { viewport: { width: 1280, height: 720 } } },
    {
      name: 'mobile',
      testIgnore: '**/firebase/**',
      use: {
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // fake, non-secret web config: never a real project
      VITE_FIREBASE_API_KEY: 'fake-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-qa.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-qa',
      VITE_FIREBASE_APP_ID: '1:0:web:qa',
      VITE_DATA_BACKEND: 'local',
    },
  },
})
