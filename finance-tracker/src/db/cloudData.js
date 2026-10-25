import { normalizeGoal } from '../lib/goals'
import { sourceFor } from '../lib/income'
import { MAX_CENTS } from '../lib/money'
import { cleanCurrency, cleanName } from '../lib/onboarding'
import { normalizePaymentMethod } from '../lib/payment'
import { normalizeSchedule } from '../lib/quincenaSchedule'

// The documents the app writes to Firestore, as plain objects (no Firebase
// here). cloudStorage.js sends exactly these, firestore.rules validates exactly
// these (key by key), and the rules tests of qa-firebase/ replay them, so the
// three stay in step. If a builder changes, change firestore.rules too (a test
// in firestoreRules.test.js fails when a written field is missing from them).

// Whole cents, or an error: nothing that is not a positive amount within the
// app's cap ever reaches Firestore
export function toCents(amount) {
  const cents = Math.round(amount * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) {
    throw new Error(`Invalid amount: ${amount}`)
  }
  return cents
}

export const centsOrNull = (amount) => (amount > 0 ? toCents(amount) : null)
export const isCents = (value) => Number.isSafeInteger(value) && value > 0 && value <= MAX_CENTS

// The name of a budget document: one per category and currency
export const budgetId = (categoryId, currency) => `${categoryId}_${currency}`

export function transactionData(tx) {
  return {
    amountCents: toCents(tx.amount),
    currency: tx.currency,
    type: tx.type,
    categoryId: tx.categoryId ?? null,
    note: tx.note ?? '',
    date: tx.date,
    paymentMethod: normalizePaymentMethod(tx.paymentMethod),
    // only an income has a source; without one the field is left out
    ...(sourceFor(tx) && { source: sourceFor(tx) }),
  }
}

export function recurringData(item) {
  return {
    amountCents: toCents(item.amount),
    currency: item.currency,
    type: item.type,
    categoryId: item.categoryId ?? null,
    note: item.note ?? '',
    schedule: item.schedule,
  }
}

// A whole recurring document (a new item, a restore): recurringData plus the
// last quincena handled
export function newRecurringData(item, lastPeriod = null) {
  return { ...recurringData(item), lastPeriod }
}

export function savingsData(move) {
  return {
    amountCents: toCents(move.amount),
    currency: move.currency,
    direction: move.direction,
    note: move.note ?? '',
    date: move.date,
  }
}

export function goalData(goal) {
  const clean = normalizeGoal(goal)
  return {
    name: clean.name,
    targetCents: toCents(clean.target),
    currency: clean.currency,
    createdAt: clean.createdAt,
    achievedAt: clean.achievedAt,
  }
}

export function profileData(profile) {
  return {
    name: cleanName(profile.name),
    incomeCents: centsOrNull(profile.income),
    currency: cleanCurrency(profile.currency),
    savingsGoalCents: centsOrNull(profile.savingsGoal),
    onboardedAt: profile.onboardedAt ?? null,
  }
}

export function categoryData({ name, color }) {
  return { name, color }
}

export function budgetData(categoryId, currency, amount) {
  return { categoryId, currency, amountCents: toCents(amount) }
}

export function scheduleData(schedule) {
  return { entries: normalizeSchedule(schedule) }
}
