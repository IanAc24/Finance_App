import * as cloud from './cloudStorage'
import * as local from './storage'
import { isCloudData } from '../lib/firebase'

// What TransactionsProvider uses to read and save. Each account's data is in
// the cloud (cloudStorage.js); with VITE_DATA_BACKEND=local everything goes
// to the one SQLite database of this device (storage.js), as before.
const store = () => (isCloudData() ? cloud : local)
const call =
  (name) =>
  (...args) =>
    store()[name](...args)

export const loadAll = call('loadAll')
export const restoreAll = call('restoreAll')
export const insertTransaction = call('insertTransaction')
export const insertTransactions = call('insertTransactions')
export const updateTransaction = call('updateTransaction')
export const deleteTransaction = call('deleteTransaction')
export const insertCategory = call('insertCategory')
export const updateCategory = call('updateCategory')
export const deleteCategory = call('deleteCategory')
export const clearAll = call('clearAll')
export const setBudget = call('setBudget')
export const insertRecurring = call('insertRecurring')
export const updateRecurring = call('updateRecurring')
export const deleteRecurring = call('deleteRecurring')
export const skipRecurring = call('skipRecurring')
export const confirmRecurring = call('confirmRecurring')
export const insertSavingsMove = call('insertSavingsMove')
export const saveSavingsMove = call('saveSavingsMove')
export const insertGoal = call('insertGoal')
export const updateGoal = call('updateGoal')
export const deleteGoal = call('deleteGoal')
export const deleteSavingsMove = call('deleteSavingsMove')
export const insertIncomeWithSavings = call('insertIncomeWithSavings')
export const saveQuincenaSchedule = call('saveQuincenaSchedule')
export const completeOnboarding = call('completeOnboarding')
export const skipOnboarding = call('skipOnboarding')
export const saveProfileName = call('saveProfileName')

// The account whose data is used (only matters in the cloud)
export function setDataUser(uid) {
  if (isCloudData()) cloud.setCloudUser(uid)
}

// Saves rejected by Firebase after the app went on (only in the cloud)
export function onWriteError(listener) {
  return isCloudData() ? cloud.onCloudWriteError(listener) : () => {}
}

// The data saved on this device before accounts existed (SQLite)
export const readDeviceData = () => local.loadAll()
export const uploadDeviceData = (state) => cloud.uploadLocalData(state)

// True when the last loadAll was answered by Firebase (always with SQLite)
export const wasLoadConfirmed = () => (isCloudData() ? cloud.wasLastLoadConfirmed() : true)
