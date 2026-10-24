import { beforeEach, describe, expect, it, vi } from 'vitest'

// Firestore faked with no documents. `fake.fromCache` says whether its
// answers come from Firebase (false) or only from the browser copy (true),
// as the real snapshots say in metadata.fromCache. `fake.offline` makes the
// server reads fail, as getDocs/getDoc do without internet.
const fake = vi.hoisted(() => ({ fromCache: false, offline: false }))

vi.mock('../lib/firebase', () => ({ getCloudDb: () => ({}) }))

vi.mock('firebase/firestore', () => {
  const empty = (fromCache) => ({ docs: [], metadata: { fromCache } })
  const missing = (fromCache) => ({ exists: () => false, data: () => undefined, metadata: { fromCache } })
  const server = (value) => async () => {
    if (fake.offline) throw Object.assign(new Error('offline'), { code: 'unavailable' })
    return value(fake.fromCache)
  }
  return {
    collection: (db, ...parts) => ({ path: parts.join('/') }),
    doc: (db, ...parts) => ({ path: parts.join('/') }),
    query: (target) => target,
    where: () => ({}),
    getDocs: server(empty),
    getDoc: server(missing),
    getDocsFromCache: async () => empty(true),
    getDocFromCache: async () => missing(true),
    writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
  }
})

const cloud = await import('./cloudStorage')

beforeEach(() => {
  fake.fromCache = false
  fake.offline = false
  cloud.setCloudUser('ana')
})

describe('wasLastLoadConfirmed', () => {
  it('is true when Firebase answered the load', async () => {
    await cloud.loadAll()
    expect(cloud.wasLastLoadConfirmed()).toBe(true)
  })

  it('is false when the answer came only from the browser copy', async () => {
    fake.fromCache = true
    await cloud.loadAll()
    expect(cloud.wasLastLoadConfirmed()).toBe(false)
  })

  it('is false without internet, when the reads fall back to the browser copy', async () => {
    fake.offline = true
    const state = await cloud.loadAll()
    expect(state.transactions).toEqual([])
    expect(cloud.wasLastLoadConfirmed()).toBe(false)
  })

  it('a later confirmed load makes it true again', async () => {
    fake.offline = true
    await cloud.loadAll()
    fake.offline = false
    await cloud.loadAll()
    expect(cloud.wasLastLoadConfirmed()).toBe(true)
  })
})
