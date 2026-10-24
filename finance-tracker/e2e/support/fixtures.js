import { test as base, expect } from '@playwright/test'
import { FakeAuth, installNetwork } from './fakeAuth.js'

// Every test gets: a fresh browser context (clean IndexedDB/localStorage), a
// fresh in-memory fake of Firebase Auth, and the network lockdown. After the
// test it fails if anything escaped to a real host, if Firestore was called
// (the tests run with VITE_DATA_BACKEND=local) or if the page threw.
export const test = base.extend({
  fake: async ({}, use) => {
    await use(new FakeAuth())
  },

  // auto: installs the network rules and checks them at the end
  network: [
    async ({ context, fake, page }, use) => {
      const pageErrors = []
      const hosts = new Set()
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('request', (request) => {
        try {
          hosts.add(new URL(request.url()).hostname)
        } catch {
          // data: and blob: URLs
        }
      })
      fake.hosts = hosts
      await installNetwork(context, fake)
      await use(fake)
      expect.soft(fake.escaped, 'requests that escaped to a real host').toEqual([])
      expect.soft(fake.firestore, 'Firestore calls in local data mode').toEqual([])
      expect.soft(fake.unhandled, 'Google auth endpoints the fake does not know').toEqual([])
      expect.soft(pageErrors, 'uncaught errors in the page').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
