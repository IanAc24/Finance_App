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

// Key of the "Not now" on the Home backup reminder: a YYYY-MM-DD date
export const BACKUP_SNOOZE_PREF = 'backupReminderSnoozedUntil'

// What "Delete all data" removes from this device besides the database. The
// last two are the keys of the one-time import of the first localStorage
// version (see db/storage.js); with both gone that import finds nothing to
// copy. Kept on purpose: lang, theme and legalConsent (the consent is
// withdrawn on its own in Settings).
export const ERASED_PREFS = [
  'lastCurrency',
  'lastPaymentMethod',
  'lastCategoryId',
  'lastBackup',
  BACKUP_SNOOZE_PREF,
  'finance-data',
  'finance-data-imported',
]
