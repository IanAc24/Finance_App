// Small device preferences in localStorage. Storage can be blocked:
// reading then gives null and writing does nothing.
export function readPref(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // blocked: the preference just is not remembered
  }
}

export function removePref(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // blocked: there is nothing to remove
  }
}
