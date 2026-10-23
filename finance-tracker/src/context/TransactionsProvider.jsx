import { useEffect, useState } from 'react'
import { TransactionsContext } from './TransactionsContext'
import { categories as builtInCategories } from '../db/mockData'
import {
  clearAll,
  completeOnboarding as storeOnboarding,
  confirmRecurring as saveConfirmedRecurring,
  deleteCategory as removeCategory,
  deleteRecurring as removeRecurring,
  deleteSavingsMove as removeSavingsMove,
  deleteTransaction as removeTransaction,
  insertCategory,
  insertIncomeWithSavings,
  insertRecurring,
  insertSavingsMove,
  insertTransaction,
  insertTransactions,
  loadAll,
  restoreAll,
  saveProfileName as storeProfileName,
  saveQuincenaSchedule as storeQuincenaSchedule,
  skipOnboarding as storeSkipOnboarding,
  setBudget as saveBudget,
  skipRecurring as saveSkippedRecurring,
  updateCategory as replaceCategory,
  updateRecurring as replaceRecurring,
  updateTransaction as replaceTransaction,
} from '../db/storage'
import { acquireTabLock } from '../db/tabLock'
import { customColorAt, findCategoryByName } from '../lib/categories'
import { quincenaKey, todayString } from '../lib/dates'
import { currencies } from '../lib/money'
import { EMPTY_PROFILE, isOnboarded } from '../lib/onboarding'
import { ERASED_PREFS, removePref } from '../lib/prefs'
import { DEFAULT_SCHEDULE } from '../lib/quincenaSchedule'
import { rolloverSkipKey } from '../lib/savings'
import { sampleTransactions } from '../lib/sample'
import StatusScreen from '../components/StatusScreen'
import { useSettings } from './useSettings'

// If the database has not opened by then (for example the SQLite file cannot
// be loaded) the error screen appears instead of "opening" forever
export const LOAD_TIMEOUT_MS = 15000

export default function TransactionsProvider({ children }) {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState(builtInCategories)
  const [budgets, setBudgets] = useState([])
  const [recurring, setRecurring] = useState([])
  const [savings, setSavings] = useState([])
  const [quincenaSchedule, setQuincenaSchedule] = useState(DEFAULT_SCHEDULE)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  // true while the welcome is being done again from Settings (not saved: if
  // the app is closed the person is back where they were)
  const [repeating, setRepeating] = useState(false)
  const [loading, setLoading] = useState(true)
  // false, 'failed' (the database could not be opened) or 'timeout'
  const [error, setError] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const { lang, t } = useSettings()

  // puts a whole state read from the database on screen
  const applyState = (state) => {
    setTransactions(state.transactions)
    setCategories(state.categories)
    setBudgets(state.budgets)
    setRecurring(state.recurring)
    setSavings(state.savings)
    setQuincenaSchedule(state.quincenaSchedule)
    setProfile(state.profile)
  }

  useEffect(() => {
    let ignore = false
    let finished = false
    const timer = setTimeout(() => {
      if (ignore || finished) return
      finished = true
      setError('timeout')
      setLoading(false)
    }, LOAD_TIMEOUT_MS)
    acquireTabLock()
      .then((hasLock) => {
        if (!hasLock) {
          if (ignore || finished) return null
          finished = true
          setBlocked(true)
          setLoading(false)
          return null
        }
        return loadAll()
      })
      .then((data) => {
        if (ignore || finished || !data) return
        finished = true
        applyState(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        if (ignore || finished) return
        finished = true
        setError('failed')
        setLoading(false)
      })
      .finally(() => clearTimeout(timer))
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [])

  const addTransaction = async (tx) => {
    const saved = await insertTransaction(tx)
    setTransactions((current) => [...current, saved])
    return saved
  }

  const updateTransaction = async (id, tx) => {
    const saved = await replaceTransaction(id, tx)
    setTransactions((current) =>
      current.map((item) => (item.id === id ? saved : item)),
    )
  }

  const deleteTransaction = async (id) => {
    await removeTransaction(id)
    setTransactions((current) => current.filter((item) => item.id !== id))
  }

  // Returns the id of the new category, or of an existing one with that name
  const addCategory = async (name) => {
    const existing = findCategoryByName(categories, name)
    if (existing) return existing.id

    // the color is saved with the category so it never changes
    const color = customColorAt(categories.length - builtInCategories.length)
    const saved = await insertCategory({ name, color })
    setCategories((current) => [...current, saved])
    return saved.id
  }

  const updateCategory = async (id, changes) => {
    const saved = await replaceCategory(id, changes)
    setCategories((current) =>
      current.map((item) => (item.id === id ? saved : item)),
    )
  }

  // its transactions move to moveToId
  const deleteCategory = async (id, moveToId) => {
    await removeCategory(id, moveToId)
    setCategories((current) => current.filter((item) => item.id !== id))
    setTransactions((current) =>
      current.map((item) =>
        item.categoryId === id ? { ...item, categoryId: moveToId } : item,
      ),
    )
    setRecurring((current) =>
      current.map((item) =>
        item.categoryId === id ? { ...item, categoryId: moveToId } : item,
      ),
    )
    // the database already removed them
    setBudgets((current) => current.filter((item) => item.categoryId !== id))
  }

  // an amount of 0 removes the budget
  const setBudget = async (categoryId, currency, amount) => {
    const saved = await saveBudget(categoryId, currency, amount)
    setBudgets((current) => {
      const rest = current.filter(
        (item) => item.categoryId !== categoryId || item.currency !== currency,
      )
      return saved ? [...rest, saved] : rest
    })
  }

  const addRecurring = async (item) => {
    const saved = await insertRecurring(item)
    setRecurring((current) => [...current, saved])
  }

  const updateRecurring = async (id, item) => {
    const saved = await replaceRecurring(id, item)
    setRecurring((current) =>
      current.map((existing) => (existing.id === id ? saved : existing)),
    )
  }

  const deleteRecurring = async (id) => {
    await removeRecurring(id)
    setRecurring((current) => current.filter((item) => item.id !== id))
  }

  // handled for this quincena, without adding anything
  const skipRecurring = async (item) => {
    const period = quincenaKey(new Date(), quincenaSchedule)
    await saveSkippedRecurring(item.id, period)
    setRecurring((current) =>
      current.map((existing) =>
        existing.id === item.id ? { ...existing, lastPeriod: period } : existing,
      ),
    )
  }

  // adds a real transaction and marks the item as handled for this quincena.
  // Without tx it is built from the item and dated today; with tx (what the
  // user typed) that is saved instead. Returns the saved transaction.
  const confirmRecurring = async (item, tx) => {
    const period = quincenaKey(new Date(), quincenaSchedule)
    const toSave = tx ?? {
      amount: item.amount,
      currency: item.currency,
      type: item.type,
      categoryId: item.type === 'expense' ? item.categoryId : null,
      note: item.note,
      date: todayString(),
    }
    const saved = await saveConfirmedRecurring(item.id, period, toSave)
    setTransactions((current) => [...current, saved])
    setRecurring((current) =>
      current.map((existing) =>
        existing.id === item.id ? { ...existing, lastPeriod: period } : existing,
      ),
    )
    return saved
  }

  const addSavingsMove = async (move) => {
    const saved = await insertSavingsMove(move)
    setSavings((current) => [...current, saved])
    return saved
  }

  const deleteSavingsMove = async (id) => {
    await removeSavingsMove(id)
    setSavings((current) => current.filter((item) => item.id !== id))
  }

  // an income and the part of it sent to savings, saved together
  const addIncomeWithSavings = async (tx, move) => {
    const saved = await insertIncomeWithSavings(tx, move)
    setTransactions((current) => [...current, saved.transaction])
    setSavings((current) => [...current, saved.move])
    return saved.transaction
  }

  const loadSampleData = async () => {
    const saved = await insertTransactions(sampleTransactions(new Date(), lang, quincenaSchedule))
    setTransactions((current) => [...current, ...saved])
  }

  const clearAllData = async () => {
    await clearAll()
    // forget the skipped leftover offers kept on this device
    currencies.forEach(({ code }) => removePref(rolloverSkipKey(code)))
    // and the last-used choices, the backup dates and the old-version data
    ERASED_PREFS.forEach((key) => removePref(key))
    setTransactions([])
    setCategories(builtInCategories)
    setBudgets([])
    setRecurring([])
    setSavings([])
    // back to 15/30 and to the welcome, like a new install
    setQuincenaSchedule(DEFAULT_SCHEDULE)
    setProfile(EMPTY_PROFILE)
    setRepeating(false)
  }

  // replaces everything with the (already cleaned) data of a backup
  const restoreData = async (data) => {
    applyState(await restoreAll(data))
  }

  // the new way to cut the quincena (see lib/quincenaSchedule changeSchedule)
  const saveQuincenaSchedule = async (schedule) => {
    const saved = await storeQuincenaSchedule(schedule)
    setQuincenaSchedule(saved)
  }

  // the welcome: saves everything the person chose in one go and leaves it
  const completeOnboarding = async (payload) => {
    applyState(await storeOnboarding(payload))
    setRepeating(false)
  }

  // no welcome, nothing else changed. A repeat just closes.
  const skipOnboarding = async () => {
    if (!repeating) setProfile(await storeSkipOnboarding())
    setRepeating(false)
  }

  const startOnboarding = () => setRepeating(true)

  const saveProfileName = async (name) => {
    setProfile(await storeProfileName(name))
  }

  // screens never see a half-loaded state
  if (loading) return <StatusScreen busy text={t('loading')} />

  if (blocked) {
    return (
      <StatusScreen
        text={t('otherTab')}
        actionLabel={t('retry')}
        onAction={() => window.location.reload()}
      />
    )
  }

  if (error) {
    return (
      <StatusScreen
        text={
          error === 'timeout'
            ? `${t('statusDbSlow')} ${t('dbError')}`
            : t('dbError')
        }
        actionLabel={t('retry')}
        onAction={() => window.location.reload()}
      />
    )
  }

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        budgets,
        setBudget,
        recurring,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        skipRecurring,
        confirmRecurring,
        savings,
        addSavingsMove,
        deleteSavingsMove,
        quincenaSchedule,
        saveQuincenaSchedule,
        profile,
        showOnboarding: repeating || !isOnboarded(profile),
        repeatingOnboarding: repeating,
        completeOnboarding,
        skipOnboarding,
        startOnboarding,
        saveProfileName,
        addIncomeWithSavings,
        loadSampleData,
        clearAllData,
        restoreData,
      }}
    >
      {children}
    </TransactionsContext.Provider>
  )
}
