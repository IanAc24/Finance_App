import { readPref, removePref, writePref } from './prefs'

// The version of the four legal texts people accept. Change it when a text
// changes in a way that needs a new acceptance.
export const LEGAL_VERSION = '1.0'
export const CONSENT_PREF = 'legalConsent'

// The legal documents, in the order they are listed; `titleKey` is the
// translation key of the name
export const LEGAL_DOCS = [
  { id: 'privacy', titleKey: 'legalPrivacy' },
  { id: 'terms', titleKey: 'legalTerms' },
  { id: 'refunds', titleKey: 'legalRefunds' },
  { id: 'cookies', titleKey: 'legalCookies' },
]

export function isLegalDoc(id) {
  return LEGAL_DOCS.some((doc) => doc.id === id)
}

// The saved text as { version, acceptedAt }, or null when it is missing or
// is not what writeConsent saves
export function parseConsent(raw) {
  if (typeof raw !== 'string') return null
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (
    !value ||
    typeof value.version !== 'string' ||
    value.version === '' ||
    typeof value.acceptedAt !== 'string' ||
    Number.isNaN(new Date(value.acceptedAt).getTime())
  ) {
    return null
  }
  return { version: value.version, acceptedAt: value.acceptedAt }
}

export function readConsent() {
  return parseConsent(readPref(CONSENT_PREF))
}

// Only an acceptance of the current version lets the person in
export function hasCurrentConsent(consent) {
  return Boolean(consent) && consent.version === LEGAL_VERSION
}

export function buildConsent(now) {
  return { version: LEGAL_VERSION, acceptedAt: now.toISOString() }
}

// Saves the acceptance on this device and returns it
export function writeConsent(now) {
  const consent = buildConsent(now)
  writePref(CONSENT_PREF, JSON.stringify(consent))
  return consent
}

// Withdrawing: the acceptance is forgotten (the caller clears the data)
export function withdrawConsent() {
  removePref(CONSENT_PREF)
}
