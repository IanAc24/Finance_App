import { readPref, writePref } from './prefs'

// The data saved on this device before accounts existed (the SQLite
// database) belongs to nobody. The first account with no data of its own is
// asked whether to take it; once one takes it, no other account is asked.
// An account that says no is not asked again. The data on the device is
// never changed or deleted by this.

const OWNER_PREF = 'deviceDataOwner'
const declinedPref = (uid) => `deviceDataDeclined:${uid}`

// What a state has, in the shape summarizeCounts (backup.js) reads
export function countState(state) {
  return {
    transactions: state.transactions.length,
    budgets: state.budgets.length,
    recurring: state.recurring.length,
    savings: state.savings.length,
    goals: (state.goals ?? []).length,
    categories: state.categories.filter((c) => c.name).length,
  }
}

export function hasData(state) {
  return Object.values(countState(state)).some((n) => n > 0) || Boolean(state.profile?.onboardedAt)
}

// True when the account could be offered the data of this device
export function canOfferDeviceData(uid, accountState) {
  if (!uid || hasData(accountState)) return false
  if (readPref(OWNER_PREF)) return false
  return readPref(declinedPref(uid)) !== '1'
}

export function markDeviceDataTaken(uid) {
  writePref(OWNER_PREF, uid)
}

export function markDeviceDataDeclined(uid) {
  writePref(declinedPref(uid), '1')
}
