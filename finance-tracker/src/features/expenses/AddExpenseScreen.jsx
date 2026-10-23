import { useEffect, useState } from 'react'
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { categoryLabel } from '../../lib/categories'
import { daysBetween, isValidDate, parseDate, todayString } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import { applyKey, formatTyping } from '../../lib/keypad'
import { MAX_CATEGORY_NAME_LENGTH, MAX_NOTE_LENGTH } from '../../lib/limits'
import { MAX_AMOUNT, currencies, parseAmount } from '../../lib/money'
import { isClosingDay, nextQuincenaStart } from '../../lib/quincena'
import { normalizePaymentMethod } from '../../lib/payment'
import { readPref, writePref } from '../../lib/prefs'
import { findMatchingDue } from '../../lib/recurring'
import { suggestNotes } from '../../lib/suggest'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import CurrencyPills from '../../components/CurrencyPills'
import Keypad from '../../components/Keypad'
import PaymentPills from '../../components/PaymentPills'

// A warning shows when the date is more than this many days ahead
const FUTURE_DAYS_LIMIT = 3

// The currency of the last transaction added, if it is still a known one
function lastCurrency(fallback) {
  const saved = readPref('lastCurrency')
  return currencies.some((c) => c.code === saved) ? saved : fallback
}

// The payment method of the last transaction added (cash if none saved)
function lastPaymentMethod() {
  return normalizePaymentMethod(readPref('lastPaymentMethod'))
}

// The category of the last expense added, if it still exists
function lastCategoryId(categories) {
  const saved = Number(readPref('lastCategoryId'))
  return categories.some((c) => c.id === saved) ? saved : categories[0].id
}

// An entry to repeat, passed in the route state; anything malformed is ignored
function validRepeat(value) {
  if (!value || typeof value !== 'object') return null
  if (value.type !== 'income' && value.type !== 'expense') return null
  if (!currencies.some((c) => c.code === value.currency)) return null
  return value
}

// Used for both /add and /edit/:id
export default function AddExpenseScreen() {
  const { locale, t } = useSettings()
  const { confirm } = useDialog()
  const {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    categories,
    addCategory,
    recurring,
    quincenaSchedule,
    profile,
    confirmRecurring,
    addSavingsMove,
    addIncomeWithSavings,
  } = useTransactions()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const [params] = useSearchParams()

  const editing = id ? transactions.find((tx) => tx.id === Number(id)) : null
  const backTo = location.state?.from ?? '/history'
  // only when adding: the entry being repeated, which beats prefs and ?type=
  const repeat = editing || id ? null : validRepeat(location.state?.repeat)
  const source = editing ?? repeat

  const [type, setType] = useState(
    source?.type ?? (params.get('type') === 'income' ? 'income' : 'expense'),
  )
  const [currency, setCurrency] = useState(() =>
    source ? source.currency : lastCurrency(profile.currency),
  )
  // an edit or a repeat keeps its method; a new entry starts with the last used
  const [paymentMethod, setPaymentMethod] = useState(() =>
    source ? normalizePaymentMethod(source.paymentMethod) : lastPaymentMethod(),
  )
  const [amountText, setAmountText] = useState(() =>
    source && Number.isFinite(source.amount) ? String(source.amount) : '',
  )
  // categoryId is null while a custom category is being typed
  const [categoryId, setCategoryId] = useState(() => {
    if (editing) return editing.categoryId ?? categories[0].id
    if (repeat && categories.some((c) => c.id === repeat.categoryId)) {
      return repeat.categoryId
    }
    return lastCategoryId(categories)
  })
  const [customName, setCustomName] = useState('')
  const [note, setNote] = useState(
    typeof source?.note === 'string' ? source.note : '',
  )
  const [date, setDate] = useState(editing?.date ?? todayString)
  const [toSavingsText, setToSavingsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const handleKey = (key) => {
    setAmountText((text) => applyKey(text, key, currency))
  }

  // the physical keyboard types the amount too (digits, point or comma,
  // Backspace), unless the focus is on a field that takes text itself
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      // a dialog (confirm / alert) is open: the keys are for it, not the amount
      if (document.querySelector('dialog[open]')) return
      if (event.target.closest?.('input, select, textarea, [contenteditable]')) {
        return
      }
      let key = null
      if (/^[0-9]$/.test(event.key)) key = event.key
      else if (event.key === 'Backspace') key = '⌫'
      else if (event.key === '.' || event.key === ',') key = '.'
      if (key === null) return
      event.preventDefault()
      setAmountText((text) => applyKey(text, key, currency))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currency])

  // the id in the address does not exist, or was just deleted: go back
  if (id && !editing) return <Navigate to={backTo} replace />

  const suggestions = suggestNotes(transactions, note, type)
  const amount = parseFloat(amountText) || 0
  const { symbol } = currencies.find((c) => c.code === currency)
  const isCustom = type === 'expense' && categoryId === null
  const dateValid = isValidDate(date)
  const isFarFuture =
    dateValid && daysBetween(new Date(), parseDate(date)) > FUTURE_DAYS_LIMIT
  // part of an income can go straight to savings (only when adding)
  const showToSavings = !editing && type === 'income'
  const toSavingsParsed = parseAmount(toSavingsText)
  const toSavingsValid =
    toSavingsParsed !== null && toSavingsParsed <= amount
  const toSavings = showToSavings && toSavingsValid ? toSavingsParsed : 0
  const amountTooBig = amount > MAX_AMOUNT
  // case L1: pay dated on the 15th / the last day of the month
  const closingDayIncome = type === 'income' && dateValid && isClosingDay(date, quincenaSchedule)
  const nextStart = closingDayIncome ? nextQuincenaStart(date, quincenaSchedule) : null
  const canSave =
    amount > 0 &&
    !amountTooBig &&
    dateValid &&
    (!isCustom || customName.trim() !== '') &&
    (!showToSavings || toSavingsValid)

  // the same name RecurringRow shows for the item
  const matchQuestion = (item) => {
    const category =
      item.type === 'expense'
        ? categories.find((c) => c.id === item.categoryId)
        : undefined
    const fallback = item.type === 'income' ? t('income') : t('typeExpense')
    const name = item.note || (category ? categoryLabel(category, t) : fallback)
    return `${t('matchesRecurring')} "${name}". ${t('markPaidQuestion')}`
  }

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setSaveError(false)
    try {
      const savedCategoryId = isCustom
        ? await addCategory(customName.trim())
        : categoryId
      const tx = {
        amount,
        currency,
        type,
        categoryId: type === 'expense' ? savedCategoryId : null,
        note: note.trim(),
        date,
        paymentMethod,
      }

      if (editing) {
        await updateTransaction(editing.id, tx)
        navigate(backTo)
      } else {
        // a due recurring item with the same amount may be this very bill
        const match = findMatchingDue(recurring, tx, new Date(), quincenaSchedule)
        const move =
          toSavings > 0
            ? {
                amount: toSavings,
                currency,
                direction: 'in',
                note: tx.note,
                date,
              }
            : null
        const matched =
          match &&
          (
            await confirm({
              message: matchQuestion(match),
              confirmLabel: t('markPaidYes'),
              cancelLabel: t('markPaidNo'),
            })
          ).confirmed
        if (matched) {
          await confirmRecurring(match, tx)
          if (move) await addSavingsMove(move)
        } else if (move) {
          await addIncomeWithSavings(tx, move)
        } else {
          await addTransaction(tx)
        }
        writePref('lastCurrency', currency)
        writePref('lastPaymentMethod', paymentMethod)
        if (type === 'expense') writePref('lastCategoryId', savedCategoryId)
        navigate('/')
      }
    } catch (error) {
      console.error(error)
      setSaving(false)
      setSaveError(true)
    }
  }

  const handleRepeat = () => {
    if (saving) return
    navigate('/add', { state: { repeat: editing } })
  }

  const applySuggestion = (suggestion) => {
    setNote(suggestion.note)
    if (type === 'expense' && categories.some((c) => c.id === suggestion.categoryId)) {
      setCategoryId(suggestion.categoryId)
    }
  }

  const handleDelete = async () => {
    if (saving) return
    // once deleted, the check above sends the screen back
    const { confirmed } = await confirm({
      message: t('confirmDelete'),
      confirmLabel: t('delete'),
      danger: true,
    })
    if (!confirmed) return
    setSaveError(false)
    try {
      await deleteTransaction(editing.id)
    } catch (error) {
      console.error(error)
      setSaveError(true)
    }
  }

  let title = type === 'income' ? t('addIncome') : t('addExpense')
  if (editing) title = t('editTransaction')

  return (
    <>
      <h1 className="screen-title">{title}</h1>

      <div className="pill-group center">
        {['expense', 'income'].map((tp) => (
          <button
            key={tp}
            type="button"
            className={type === tp ? 'pill active' : 'pill'}
            aria-pressed={type === tp}
            onClick={() => setType(tp)}
          >
            {tp === 'expense' ? t('typeExpense') : t('typeIncome')}
          </button>
        ))}
      </div>

      <div className="cols">
        <div className="col">
          <section className="card">
            <CurrencyPills value={currency} onChange={setCurrency} />
            <p className="label amount-label">{t('amount')}</p>
            <p
              className="amount-display"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {symbol}
              {formatTyping(amountText, currency) || '0'}
            </p>
            <Keypad onKey={handleKey} currency={currency} />
          </section>
        </div>

        <div className="col">
          {type === 'expense' && (
            <section className="card">
              <p className="label">{t('category')}</p>
              <div className="pill-group wrap">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={categoryId === c.id ? 'pill active' : 'pill'}
                    aria-pressed={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                  >
                    {categoryLabel(c, t)}
                  </button>
                ))}
                <button
                  type="button"
                  className={isCustom ? 'pill active' : 'pill'}
                  aria-pressed={isCustom}
                  onClick={() => setCategoryId(null)}
                >
                  + {t('customCategory')}
                </button>
              </div>
              {isCustom && (
                <label className="field">
                  <span className="label">{t('categoryName')}</span>
                  <input
                    type="text"
                    value={customName}
                    maxLength={MAX_CATEGORY_NAME_LENGTH}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </label>
              )}
            </section>
          )}

          <section className="card">
            <p className="label">{t('paymentMethod')}</p>
            <PaymentPills value={paymentMethod} onChange={setPaymentMethod} />
            <label className="field">
              <span className="label">{t('note')}</span>
              <input
                type="text"
                value={note}
                maxLength={MAX_NOTE_LENGTH}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {suggestions.length > 0 && (
              <div className="pill-group wrap suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s.note}
                    type="button"
                    className="pill"
                    onClick={() => applySuggestion(s)}
                  >
                    {s.note}
                  </button>
                ))}
              </div>
            )}
            <label className="field">
              <span className="label">{t('date')}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {!dateValid && <p className="field-note error" role="alert">{t('invalidDate')}</p>}
            {isFarFuture && (
              <p className="field-note warning" role="status">{t('futureDateWarning')}</p>
            )}
            {closingDayIncome && (
              <div className="field-note warning">
                <p>{t('closingDayIncome')}</p>
                <button
                  type="button"
                  className="pill"
                  onClick={() => setDate(nextStart)}
                >
                  {t('dateItOn')}{' '}
                  {formatDate(parseDate(nextStart), locale, { year: false })}
                </button>
              </div>
            )}
            {showToSavings && (
              <label className="field">
                <span className="label">{t('toSavingsOptional')}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={toSavingsText}
                  onChange={(e) => setToSavingsText(e.target.value)}
                />
              </label>
            )}
            {showToSavings && !toSavingsValid && (
              <p className="field-note error" role="alert">{t('toSavingsInvalid')}</p>
            )}
          </section>

          {amountTooBig && (
            <p className="field-note error" role="alert">
              {t('amountTooBig')}
            </p>
          )}
          {saveError && <p className="field-note error" role="alert">{t('saveError')}</p>}

          {/* always visible at the bottom of the screen, even with the
              keypad and the category list above it */}
          <div className="save-bar">
            {amount === 0 && (
              <p className="sub" id="save-hint">
                {t('typeAmountFirst')}
              </p>
            )}
            <button
              type="button"
              className="btn"
              disabled={!canSave || saving}
              aria-describedby={amount === 0 ? 'save-hint' : undefined}
              onClick={handleSave}
            >
              {t('save')}
            </button>
          </div>

          {editing && (
            <button
              type="button"
              className="btn secondary"
              disabled={saving}
              onClick={handleRepeat}
            >
              {t('repeatToday')}
            </button>
          )}

          {editing && (
            <button type="button" className="btn danger" onClick={handleDelete}>
              {t('delete')}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
