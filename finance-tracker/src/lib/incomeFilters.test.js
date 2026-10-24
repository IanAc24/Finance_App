import { describe, expect, it } from 'vitest'
import { rememberedFor } from './incomeFilters'

describe('rememberedFor', () => {
  const store = { uid: 'ana', period: 'year', currency: 'USD', query: 'pay' }

  it('gives the filters back to the same account', () => {
    expect(rememberedFor(store, 'ana')).toBe(store)
  })

  it('gives nothing to another account or to nobody', () => {
    expect(rememberedFor(store, 'beto')).toBeNull()
    expect(rememberedFor(store, null)).toBeNull()
    expect(rememberedFor(null, 'ana')).toBeNull()
  })

  it('works for the signed-out (local) case too', () => {
    const local = { uid: null, period: 'month' }
    expect(rememberedFor(local, null)).toBe(local)
    expect(rememberedFor(local, 'ana')).toBeNull()
  })
})
