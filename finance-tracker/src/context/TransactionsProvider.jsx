import { useEffect, useState } from 'react'
import { TransactionsContext } from './TransactionsContext'
import { categories as builtInCategories } from '../db/mockData'
import {
  clearAll,
  completeOnboarding as storeOnboarding,
  confirmRecurring as saveConfirmedRecurring,
  deleteCategory as removeCategory,
  deleteGoal as removeGoal,
  deleteRecurring as removeRecurring,
  deleteSavingsMove as removeSavingsMove,
  deleteTransaction as removeTransaction,
  insertCategory,
  insertGoal,
  insertIncomeWithSavings,
  insertRecurring,
  insertTransaction,
  insertTransactions,
  loadAll,
  restoreAll,
  saveSavingsMove as storeSavingsMove,
  saveProfileName as storeProfileName,
  saveQuincenaSchedule as storeQuincenaSchedule,
  skipOnboarding as storeSkipOnboarding,
  setBudget as saveBudget,
  skipRecurring as saveSkippedRecurring,
  updateCategory as replaceCategory,
  updateGoal as replaceGoal,
  updateRecurring as replaceRecurring,
  updateTransaction as replaceTransaction,
  onWriteError,
  readDeviceData,
  setDataUser,
  uploadDeviceData,
  wasLoadConfirmed,
} from '../db/dataStore'
import { acquireTabLock } from '../db/tabLock'
import { summarizeCounts } from '../lib/backup'
import { customColorAt, findCategoryByName } from '../lib/categories'
import { quincenaKey, todayString } from '../lib/dates'
import {
  canOfferDeviceData,
  countState,
  hasData,
  markDeviceDataDeclined,
  markDeviceDataTaken,
} from '../lib/deviceData'
import { isCloudData } from '../lib/firebase'
import { currencies } from '../lib/money'
import { EMPTY_PROFILE, isOnboarded } from '../lib/onboarding'
import { ERASED_PREFS, removePref } from '../lib/prefs'
import { DEFAULT_SCHEDULE } from '../lib/quincenaSchedule'
import { planSavingsMove } from '../lib/goals'
import { rolloverSkipKey } from '../lib/savings'
import { sampleTransactions } from '../lib/sample'
import StatusScreen from '../components/StatusScreen'
import { useAuth } from './useAuth'
import { useDialog } from './useDialog'
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
  const [goals, setGoals] = useState([])
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
  const { user } = useAuth()
  const { alert, confirm } = useDialog()
  const uid = user?.uid ?? null

  // puts a whole state read from the database on screen
  const applyState = (state) => {
    setTransactions(state.transactions)
    setCategories(state.categories)
    setBudgets(state.budgets)
    setRecurring(state.recurring)
    setSavings(state.savings)
    setGoals(state.goals ?? [])
    setQuincenaSchedule(state.quincenaSchedule)
    setProfile(state.profile)
  }

  // In the cloud, an account with nothing of its own is offered the data
  // saved on this device before accounts existed (see lib/deviceData)
  const offerDeviceData = async (accountState) => {
    if (!isCloudData()) return null
    if (!canOfferDeviceData(uid, accountState, { confirmed: wasLoadConfirmed() })) return null
    // the device database allows one tab at a time: if another tab has it,
    // the offer waits for another time
    if (!(await acquireTabLock())) return null
    const device = await readDeviceData()
    if (!hasData(device)) return null
    return device
  }

  useEffect(() => {
    let ignore = false
    let finished = false
    const finish = (show) => {
      if (ignore || finished) return
      finished = true
      clearTimeout(timer)
      show()
    }
    const timer = setTimeout(
      () =>
        finish(() => {
          setError('timeout')
          setLoading(false)
        }),
      LOAD_TIMEOUT_MS,
    )
    const run = async () => {
      setDataUser(uid)
      // only the one database of this device needs a single tab; in the
      // cloud Firestore shares its browser copy between tabs
      const hasLock = isCloudData() || (await acquireTabLock())
      if (!hasLock) {
        finish(() => {
          setBlocked(true)
          setLoading(false)
        })
        return
      }
      let data = await loadAll()
      if (ignore || finished) return
      const device = await offerDeviceData(data)
      if (device && !ignore && !finished) {
        // the person may take a while to answer: no time limit meanwhile
        clearTimeout(timer)
        const { confirmed } = await confirm({
          message: [
            t('deviceDataIntro'),
            '',
            summarizeCounts(countState(device), t),
            '',
            t('deviceDataHint'),
          ].join('\n'),
          confirmLabel: t('deviceDataTake'),
        })
        if (ignore) return
        if (confirmed) {
          data = await uploadDeviceData(device)
          markDeviceDataTaken(uid)
        } else {
          markDeviceDataDeclined(uid)
        }
      }
      finish(() => {
        applyState(data)
        setLoading(false)
      })
    }
    run().catch((err) => {
      console.error(err)
      finish(() => {
        setError('failed')
        setLoading(false)
      })
    })
    return () => {
      ignore = true
      clearTimeout(timer)
    }
    // runs once per account: AuthGate mounts a new provider for each one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A save that Firebase rejected after the app went on: say so and show
  // what is really saved
  useEffect(
    () =>
      onWriteError(async (err) => {
        console.warn('cloud write', err?.code ?? 'unknown')
        try {
          applyState(await loadAll())
        } catch (loadError) {
          console.error(loadError)
        }
        await alert(t('saveError'))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

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

  // Saves a savings move. The caller makes `move.id` ONCE per user action
  // (newId() from lib/ids) so that a retry rewrites the same record instead
  // of adding a second one. Before writing:
  //  - a withdrawal larger than the balance of its currency throws an Error
  //    with code 'insufficientSavings' and nothing is written;
  //  - a deposit marks, in the same write, the goals it reaches (achievedAt =
  //    today). A withdrawal that later drops the balance below a target does
  //    NOT clear achievedAt: a goal reached once stays reached.
  // options.awaitServer: wait for Google (up to 8 s) before answering.
  // Returns { move, status, achievedGoalIds }: status is 'confirmed' once the
  // server (or, locally, the database) accepted it, 'pending' if the server
  // has not answered yet (the save is queued and will sync); play the success
  // animation only on 'confirmed'. achievedGoalIds are the goals newly
  // reached, to celebrate. Rejects when the save fails.
  const saveSavingsMove = async (move, options = {}) => {
    const plan = planSavingsMove(move, savings, goals)
    if (!plan.ok) {
      throw Object.assign(new Error('Not enough in savings'), { code: plan.code })
    }
    const achievedAt = todayString()
    const result = await storeSavingsMove(move, {
      awaitServer: options.awaitServer,
      achieveGoalIds: plan.achieveGoalIds,
      achievedAt,
    })
    setSavings((current) => [
      ...current.filter((item) => item.id !== result.move.id),
      result.move,
    ])
    if (result.achievedGoalIds.length > 0) {
      setGoals((current) =>
        current.map((goal) =>
          result.achievedGoalIds.includes(goal.id) ? { ...goal, achievedAt } : goal,
        ),
      )
    }
    return result
  }

  // Same, returning only the saved move (what the screens used before)
  const addSavingsMove = async (move) => (await saveSavingsMove(move)).move

  // Savings goals: { name, target, currency } (createdAt defaults to today,
  // achievedAt to null). Each returns { goal, status } like saveSavingsMove.
  // A goal id made by the caller once makes a retry safe. updateGoal merges
  // the changes into the goal: raising a reached goal's target does not clear
  // achievedAt unless the caller passes achievedAt: null.
  const addGoal = async (goal, options = {}) => {
    const result = await insertGoal(goal, options)
    setGoals((current) => [
      ...current.filter((item) => item.id !== result.goal.id),
      result.goal,
    ])
    return result
  }

  const updateGoal = async (id, changes, options = {}) => {
    const existing = goals.find((item) => item.id === id)
    if (!existing) throw new Error(`Goal not found: ${id}`)
    const result = await replaceGoal(id, { ...existing, ...changes }, options)
    setGoals((current) =>
      current.map((item) => (item.id === id ? result.goal : item)),
    )
    return result
  }

  const deleteGoal = async (id) => {
    await removeGoal(id)
    setGoals((current) => current.filter((item) => item.id !== id))
  }

  const deleteSavingsMove = async (id) => {
    await removeSavingsMove(id)
    setSavings((current) => current.filter((item) => item.id !== id))
  }

  // an income and the part of it sent to savings, saved together (and the
  // goals that deposit reaches are marked in the same write). Returns the
  // saved income; a goal newly reached shows as achievedAt set in `goals`.
  const addIncomeWithSavings = async (tx, move, options = {}) => {
    const plan = planSavingsMove(move, savings, goals)
    const achievedAt = todayString()
    const saved = await insertIncomeWithSavings(tx, move, {
      awaitServer: options.awaitServer,
      achieveGoalIds: plan.ok ? plan.achieveGoalIds : [],
      achievedAt,
    })
    setTransactions((current) => [...current, saved.transaction])
    setSavings((current) => [
      ...current.filter((item) => item.id !== saved.move.id),
      saved.move,
    ])
    if (saved.achievedGoalIds.length > 0) {
      setGoals((current) =>
        current.map((goal) =>
          saved.achievedGoalIds.includes(goal.id) ? { ...goal, achievedAt } : goal,
        ),
      )
    }
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
    setGoals([])
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
        saveSavingsMove,
        deleteSavingsMove,
        goals,
        addGoal,
        updateGoal,
        deleteGoal,
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
