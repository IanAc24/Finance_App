import { createHash } from 'node:crypto'

// Deterministic randomness for the browser tests: the same QA_SEED always
// gives the same sequence (mulberry32).
export const SEED = String(process.env.QA_SEED ?? '20261024')

function hashToInt(text) {
  const digest = createHash('sha256').update(String(text)).digest()
  return digest.readUInt32LE(0)
}

export function makeRng(label = '') {
  let state = hashToInt(`${SEED}:${label}`) >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick(rng, text) {
  return text[Math.floor(rng() * text.length)]
}
