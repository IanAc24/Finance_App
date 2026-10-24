import { describe, expect, it } from 'vitest'
import { MAX_ID } from './backup'
import { newId } from './ids'

describe('newId', () => {
  it('is the time in milliseconds times 1000 plus a random part', () => {
    expect(newId(1_800_000_000_000, () => 0.4567)).toBe(1_800_000_000_000_456)
  })

  it('never repeats or goes back on the same device', () => {
    const first = newId(1_900_000_000_000, () => 0.999)
    const sameMoment = newId(1_900_000_000_000, () => 0)
    const clockBack = newId(1_000_000_000_000, () => 0.5)
    expect(sameMoment).toBeGreaterThan(first)
    expect(clockBack).toBeGreaterThan(sameMoment)
  })

  it('makes many different ids in a row', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId()))
    expect(ids.size).toBe(5000)
  })

  it('stays a safe integer that a backup accepts, for decades', () => {
    const in2120 = Date.UTC(2120, 0, 1)
    const id = newId(in2120, () => 0.999)
    expect(Number.isSafeInteger(id)).toBe(true)
    expect(id).toBeLessThanOrEqual(MAX_ID)
  })
})
