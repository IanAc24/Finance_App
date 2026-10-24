import { beforeEach, describe, expect, it } from 'vitest'
import {
  canOfferDeviceData,
  countState,
  hasData,
  markDeviceDataDeclined,
  markDeviceDataTaken,
} from './deviceData'

const empty = {
  transactions: [],
  categories: [{ id: 1, key: 'food', color: 'orange' }],
  budgets: [],
  recurring: [],
  savings: [],
  profile: { onboardedAt: null },
}

// localStorage in memory (the tests run without a browser)
beforeEach(() => {
  const items = new Map()
  globalThis.localStorage = {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
})

describe('hasData and countState', () => {
  it('a new account (only built-in categories) has nothing', () => {
    expect(hasData(empty)).toBe(false)
    expect(countState(empty)).toEqual({ transactions: 0, budgets: 0, recurring: 0, savings: 0, goals: 0, categories: 0 })
  })

  it('counts transactions, custom categories and a finished welcome as data', () => {
    expect(hasData({ ...empty, transactions: [{ id: 1 }] })).toBe(true)
    expect(hasData({ ...empty, categories: [...empty.categories, { id: 9, name: 'Casa' }] })).toBe(true)
    expect(hasData({ ...empty, profile: { onboardedAt: '2026-10-01' } })).toBe(true)
  })
})

describe('offering the data of this device', () => {
  // Firebase confirmed the account is empty (not just the browser copy)
  const ok = { confirmed: true }

  it('is not offered when only the browser copy says the account is empty (offline, new device)', () => {
    expect(canOfferDeviceData('ana', empty)).toBe(false)
    expect(canOfferDeviceData('ana', empty, { confirmed: false })).toBe(false)
  })

  it('is offered to an account with nothing of its own', () => {
    expect(canOfferDeviceData('ana', empty, ok)).toBe(true)
  })

  it('is not offered to an account that already has data, or with no account', () => {
    expect(canOfferDeviceData('ana', { ...empty, transactions: [{ id: 1 }] }, ok)).toBe(false)
    expect(canOfferDeviceData(null, empty, ok)).toBe(false)
  })

  it('once one account takes it, no other account is asked', () => {
    markDeviceDataTaken('ana')
    expect(canOfferDeviceData('beto', empty, ok)).toBe(false)
  })

  it('an account that said no is not asked again, but another one is', () => {
    markDeviceDataDeclined('ana')
    expect(canOfferDeviceData('ana', empty, ok)).toBe(false)
    expect(canOfferDeviceData('beto', empty, ok)).toBe(true)
  })
})
