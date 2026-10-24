import { useEffect, useRef, useState } from 'react'

// Shared motion kit. The pure parts (easing, interpolation, the list diff and
// the memory of the last list shown) are plain functions with tests; the hooks
// at the bottom only wire them to React. Rules: animate transform and opacity
// where possible, ease-out, under 300ms for UI, nothing on first render and
// nothing when the person asked for less motion.

// ---- Timing (the same values as the CSS tokens) ----------------------------

export const DURATION = { fast: 120, base: 200, slow: 280 }
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

// ---- Pure helpers ----------------------------------------------------------

const clamp01 = (value) => Math.min(1, Math.max(0, value))

// Ease-out (quartic): starts fast, brakes softly. 0 -> 0, 1 -> 1.
export function easeOut(progress) {
  const p = clamp01(progress)
  return 1 - Math.pow(1 - p, 4)
}

// A value between `from` and `to`; progress 1 is exactly `to`
export function interpolate(from, to, progress) {
  if (progress >= 1) return to
  if (progress <= 0) return from
  return from + (to - from) * progress
}

// The number shown `elapsed` ms into a count-up of `duration` ms. The last
// frame (elapsed >= duration) is exactly `to`, never a rounded neighbour.
export function countUpValue(from, to, elapsed, duration) {
  if (!(duration > 0) || elapsed >= duration) return to
  return interpolate(from, to, easeOut(elapsed / duration))
}

// A count-up starts only when the value really changed, both are numbers and
// the person did not ask for less motion
export function shouldCountUp(previous, next, reduced) {
  return (
    !reduced &&
    previous !== next &&
    Number.isFinite(previous) &&
    Number.isFinite(next)
  )
}

// What changed between two lists: keys that are new, keys whose signature
// changed (edited) and the entries that are gone (removed, with their old
// index so an exit animation can keep their place).
//   previous: [{ key, signature, item }]; items: the new list
export function diffList(previous, items, getKey, getSignature) {
  const before = new Map(previous.map((entry) => [entry.key, entry]))
  const keys = new Set()
  const entered = []
  const edited = []
  for (const item of items) {
    const key = getKey(item)
    keys.add(key)
    const old = before.get(key)
    if (!old) entered.push(key)
    else if (old.signature !== getSignature(item)) edited.push(key)
  }
  const removed = []
  previous.forEach((entry, index) => {
    if (!keys.has(entry.key)) removed.push({ key: entry.key, item: entry.item, index })
  })
  return { entered, edited, removed }
}

// ---- Memory of the last list shown -----------------------------------------
// A screen that unmounts (the person opens the edit screen) and mounts again
// must know what it showed before, to animate what changed meanwhile. A
// reload clears it, so nothing animates on page load. Entries older than
// MEMORY_MS are ignored.

const MEMORY_MS = 5 * 60 * 1000
const memory = new Map()

export function rememberList(id, scope, entries, now = Date.now()) {
  memory.set(id, { scope, entries, at: now })
}

export function recallList(id, scope, now = Date.now()) {
  const found = memory.get(id)
  if (!found || found.scope !== scope || now - found.at > MEMORY_MS) return null
  return found.entries
}

export function forgetLists() {
  memory.clear()
}

export const NO_MARKS = Object.freeze({ entered: [], edited: [], removed: [] })

const isEmptyDiff = (diff) =>
  diff.entered.length === 0 && diff.edited.length === 0 && diff.removed.length === 0

// ---- Hooks -----------------------------------------------------------------

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

// true when the person asked the system for less motion (reacts to changes)
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED_QUERY).matches,
  )
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_QUERY)
    if (!query) return undefined
    const onChange = (event) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// The number to SHOW for `value`. The first mount shows `value` at once; later,
// only when `value` changes, it runs from the number on screen to the new one
// (requestAnimationFrame, ease-out, `duration` ms, last frame exact). With
// reduced motion it is always `value`. Format the result on every frame with
// the formatter of the currency (see CountUpMoney).
export function useCountUp(value, { duration = 600 } = {}) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(value)
  // the number on screen, readable by the effect without re-running it
  const onScreen = useRef(value)

  useEffect(() => {
    if (!shouldCountUp(onScreen.current, value, reduced)) {
      onScreen.current = value
      return undefined
    }
    const from = onScreen.current
    let frame = 0
    let start = null
    const step = (now) => {
      if (start === null) start = now
      const next = countUpValue(from, value, now - start, duration)
      onScreen.current = next
      setShown(next)
      if (next !== value) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, reduced])

  return reduced ? value : shown
}

// How long the marks of a list stay (the exit is the longest animation)
const CLEAR_MS = 900

// Marks what changed in a list so its rows can animate: new rows (`enter`),
// edited rows (`edit`) and deleted rows (`leave`, kept as `ghosts` for the exit).
// It compares with the list it had before AND, when the screen mounts again,
// with the list it showed when it left (same `id` and `scope` only; a changed
// scope, such as another period, never animates). Nothing is marked on the
// first load of the page.
//
//   const { stateOf, ghosts } = useListTransitions(items, {
//     id: 'income', scope: 'month|CRC', getKey: (tx) => tx.id,
//     getSignature: (tx) => `${tx.amount}|${tx.note}`,
//   })
//   // render [...items, ...ghosts] and give each row stateOf(key)
export function useListTransitions(items, { id, scope = '', getKey, getSignature = () => '' }) {
  const [state, setState] = useState(() => {
    const before = recallList(id, scope)
    return {
      items,
      scope,
      marks: before ? diffList(before, items, getKey, getSignature) : NO_MARKS,
    }
  })

  // derived during render: a new list is compared with the one before it
  if (state.scope !== scope) {
    setState({ items, scope, marks: NO_MARKS })
  } else if (state.items !== items) {
    const previous = state.items.map((item) => ({
      key: getKey(item),
      signature: getSignature(item),
      item,
    }))
    const diff = diffList(previous, items, getKey, getSignature)
    setState({
      items,
      scope,
      marks: isEmptyDiff(diff)
        ? state.marks
        : {
            entered: [...state.marks.entered, ...diff.entered],
            edited: [...state.marks.edited, ...diff.edited],
            removed: [...state.marks.removed, ...diff.removed],
          },
    })
  }

  // what this screen shows now is what it remembers for the next time
  useEffect(() => {
    rememberList(
      id,
      scope,
      items.map((item) => ({ key: getKey(item), signature: getSignature(item), item })),
    )
    // getKey / getSignature are stable by contract (module functions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scope, items])

  // the marks wear off after the animations ended
  const { marks } = state
  useEffect(() => {
    if (marks === NO_MARKS) return undefined
    const timer = setTimeout(
      () => setState((s) => (s.marks === marks ? { ...s, marks: NO_MARKS } : s)),
      CLEAR_MS,
    )
    return () => clearTimeout(timer)
  }, [marks])

  const stateOf = (key) => {
    if (marks.removed.some((r) => r.key === key)) return 'leave'
    if (marks.entered.includes(key)) return 'enter'
    if (marks.edited.includes(key)) return 'edit'
    return null
  }

  return { stateOf, ghosts: marks.removed.map((r) => r.item) }
}
