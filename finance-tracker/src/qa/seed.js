// Tiny seeded PRNG for the QA tests (mulberry32). No dependency.
// QA_SEED (default 20261024) and QA_COUNT (default 500) come from the env.
export const QA_SEED = Number(globalThis.process?.env?.QA_SEED ?? 20261024) >>> 0
export const QA_COUNT = Number(globalThis.process?.env?.QA_COUNT ?? 500)

export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Integer in [min, max]
export function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1))
}

export function pick(rand, list) {
  return list[Math.floor(rand() * list.length)]
}
