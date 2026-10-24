import { useEffect, useState } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { categoryLabel } from '../../lib/categories'
import { dateWithYear, deleteMessage, itemName, signedAmount } from '../../lib/describe'
import { daysBetween, isValidDate, parseDate, todayString } from '../../lib/dates'
import { lastDays, pillDate } from '../../lib/days'
import { formatDate } from '../../lib/format'
import { applyKey, formatTyping } from '../../lib/keypad'
import { MAX_CATEGORY_NAME_LENGTH, MAX_NOTE_LENGTH } from '../../lib/limits'
import { MAX_AMOUNT, currencies, parseAmount } from '../../lib/money'
import { onceAtATime } from '../../lib/onceAtATime'
import { isClosingDay, nextQuincenaStart } from '../../lib/quincena'
import { normalizePaymentMethod } from '../../lib/payment'
import { readPref, writePref } from '../../lib/prefs'
import { findMatchingDue } from '../../lib/recurring'
import { suggestNotes } from '../../lib/suggest'
import { useToday } from '../../lib/useToday'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { useToast } from '../../context/useToast'
import { useTransactions } from '../../context/useTransactions'
import { Icon } from '../../components/CategoryIcon'
import CategoryRow from '../../components/CategoryRow'
import DateStrip from '../../components/DateStrip'
import Keypad from '../../components/Keypad'
import PaymentToggles from '../../components/PaymentToggles'
import Sheet from '../../components/Sheet'

// A warning shows when the date is more than this many days ahead
const FUTURE_DAYS_LIMIT = 3

// Under this width the bars cover part of the screen, so a focused field is
// scrolled to the middle
const PHONE_WIDTH = 900

// The name of the screen the edit came from, for the back link
function backLabel(path, t) {
  if (path === '/') return t('home')
  if (path === '/stats') return t('statistics')
  return t('history')
}

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
  const toast = useToast()
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
  const today = useToday()
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
  // the "Other date" field was opened by hand (it is also open whenever the
  // date is not one of the days of the strip)
  const [showOtherDate, setShowOtherDate] = useState(false)
  const [toSavingsText, setToSavingsText] = useState('')
  // the sheet on view: 'date', 'options' or none
  const [sheet, setSheet] = useState(null)
  // the field of the note has the focus (its suggestions float under it)
  const [noteFocused, setNoteFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  // The lock against a double save. The saving state above only paints the
  // button: it does not change between two clicks of the same tick, this does.
  const [runOnce] = useState(() => onceAtATime())

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
  const typed = formatTyping(amountText, currency) || '0'
  const { symbol } = currencies.find((c) => c.code === currency)
  const isCustom = type === 'expense' && categoryId === null
  const dateValid = isValidDate(date)
  const isFarFuture =
    dateValid && daysBetween(new Date(), parseDate(date)) > FUTURE_DAYS_LIMIT
  const inStrip = lastDays(today, 7).includes(date)
  const otherDateOpen = showOtherDate || !inStrip
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
  // the date pill warns with a different icon when the date needs a look
  const dateWarning = !dateValid || isFarFuture || closingDayIncome

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

  // The save itself. Only after it resolves does the screen leave and say so.
  const save = async () => {
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
        toast.show({ message: t('toastChangesSaved'), kind: 'success' })
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
        toast.show({
          kind: 'success',
          message: type === 'income' ? t('toastIncomeSaved') : t('toastExpenseSaved'),
          action: { label: t('addAnother'), to: `/add?type=${type}` },
        })
      }
    } catch (error) {
      console.error(error)
      setSaving(false)
      setSaveError(true)
    }
  }

  // runOnce takes the lock before anything else: a second click of the same
  // tick finds it taken and does nothing
  const handleSave = () => {
    if (!canSave) return
    runOnce(save)
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
    setNoteFocused(false)
  }

  const handleDelete = async () => {
    if (saving) return
    // once deleted, the check above sends the screen back
    const { confirmed } = await confirm({
      // names the movement so it is clear which one is about to go
      message: deleteMessage(t('confirmDelete'), {
        name: itemName(editing, categories, t),
        amount: signedAmount(
          editing.type === 'income' ? '+' : '−',
          editing.amount,
          editing.currency,
        ),
        date: dateWithYear(parseDate(editing.date), today, locale),
      }),
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

  // On phones the bars cover part of the screen: a field
  // that gets the focus is scrolled to the middle so it is never hidden
  const handleFocus = (event) => {
    if (window.innerWidth >= PHONE_WIDTH) return
    const target = event.target
    if (target.matches?.('input, select, textarea')) {
      target.scrollIntoView({ block: 'center' })
    }
  }

  let title = type === 'income' ? t('addIncome') : t('addExpense')
  if (editing) title = t('editTransaction')

  // what is wrong or worth a look with the date; it shows under the pills and
  // again inside the date sheet while that is open
  const dateNotes = (
    <>
      {!dateValid && <p className="field-note error" role="alert">{t('invalidDate')}</p>}
      {isFarFuture && (
        <p className="field-note warning" role="status">{t('futureDateWarning')}</p>
      )}
      {closingDayIncome && (
        <div className="field-note warning">
          <p>{t('closingDayIncome')}</p>
          <button type="button" className="pill" onClick={() => setDate(nextStart)}>
            {t('dateItOn')} {formatDate(parseDate(nextStart), locale, { year: false })}
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      <h1 className="sr-only">{title}</h1>

      <div className="add-screen" onFocus={handleFocus}>
        <div className="add-left">
          <div className="add-toprow">
            {/* editing: the way back shares the row of the controls, so the
                screen has no header of its own */}
            {editing && (
              <Link className="back-link is-icon" to={backTo} aria-label={backLabel(backTo, t)}>
                <Icon name="chevronLeft" size={24} />
              </Link>
            )}
            <div className="seg" role="group" aria-label={t('type')}>
              {['expense', 'income'].map((tp) => (
                <button
                  key={tp}
                  type="button"
                  className={type === tp ? 'is-on' : undefined}
                  aria-pressed={type === tp}
                  onClick={() => setType(tp)}
                >
                  {tp === 'expense' ? t('typeExpense') : t('typeIncome')}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label={t('currencyLabel')}>
              {currencies.map(({ code }) => (
                <button
                  key={code}
                  type="button"
                  className={currency === code ? 'is-on' : undefined}
                  aria-pressed={currency === code}
                  onClick={() => setCurrency(code)}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <section className="add-card" aria-label={t('amount')}>
            <p
              className={typed.length > 9 ? 'add-amount is-long' : 'add-amount'}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="money-symbol">{symbol}</span>
              {typed}
            </p>
            <div className="add-card-row">
              {/* the field to name a new category; a chosen one is already
                  marked in the row of categories below, so it is not repeated */}
              {isCustom && (
                <label className="add-chip is-input">
                  <span className="sr-only">{t('categoryName')}</span>
                  <input
                    type="text"
                    autoFocus
                    value={customName}
                    placeholder={t('categoryName')}
                    maxLength={MAX_CATEGORY_NAME_LENGTH}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </label>
              )}
              <PaymentToggles value={paymentMethod} onChange={setPaymentMethod} />
              {/* more options (send part of an income to savings): an icon in
                  the card, so it does not take a row of its own */}
              <button
                type="button"
                className="add-more"
                aria-haspopup="dialog"
                aria-label={t('moreOptions')}
                title={t('moreOptions')}
                onClick={() => setSheet('options')}
              >
                <Icon name="sliders" size={20} />
                <span className="add-more-label">{t('moreOptions')}</span>
                {toSavings > 0 && <span className="add-more-dot" aria-hidden="true" />}
              </button>
            </div>
          </section>

          <div className="add-pills">
            <button
              type="button"
              className="add-pill"
              aria-haspopup="dialog"
              aria-label={`${t('date')}: ${pillDate(date, today, locale, t)}. ${t('changeDate')}`}
              onClick={() => setSheet('date')}
            >
              <Icon name={dateWarning ? 'alert' : 'calendar'} size={20} />
              <span>{dateValid ? pillDate(date, today, locale, t) : t('invalidDate')}</span>
            </button>
            <div className="add-pill is-field">
              <Icon name="notePen" size={20} />
              <input
                type="text"
                autoComplete="off"
                aria-label={t('note')}
                placeholder={t('note')}
                value={note}
                maxLength={MAX_NOTE_LENGTH}
                onChange={(e) => setNote(e.target.value)}
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
              />
              {noteFocused && suggestions.length > 0 && (
                <ul className="add-suggest">
                  {suggestions.map((s) => (
                    <li key={s.note}>
                      <button
                        type="button"
                        // keeps the focus on the field until the click lands
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applySuggestion(s)}
                      >
                        {s.note}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {sheet !== 'date' && dateNotes}
          {amountTooBig && (
            <p className="field-note error" role="alert">
              {t('amountTooBig')}
            </p>
          )}
          {saveError && <p className="field-note error" role="alert">{t('saveError')}</p>}

          {type === 'expense' ? (
            <CategoryRow categories={categories} value={categoryId} onChange={setCategoryId} />
          ) : (
            <p className="add-income-note">
              {t('incomeNoCategory')} {t('incomeSavingsHint')}
            </p>
          )}
        </div>

        <div className="add-right">
          {amount === 0 && (
            <p className="sr-only" id="save-hint">
              {t('typeAmountFirst')}
            </p>
          )}
          <Keypad onKey={handleKey} currency={currency} />
          <button
            type="button"
            className="btn save-key"
            disabled={!canSave || saving}
            aria-busy={saving || undefined}
            aria-describedby={amount === 0 ? 'save-hint' : undefined}
            onClick={handleSave}
          >
            <Icon name="check" size={22} stroke={2.5} />
            <span>{saving ? t('saving') : t('save')}</span>
          </button>

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
            <button
              type="button"
              className="btn danger"
              disabled={saving}
              onClick={handleDelete}
            >
              {t('delete')}
            </button>
          )}
        </div>
      </div>

      <Sheet open={sheet === 'date'} onClose={() => setSheet(null)} title={t('date')}>
        <DateStrip
          today={today}
          value={date}
          onChange={(day) => {
            setDate(day)
            setShowOtherDate(false)
          }}
          otherOpen={otherDateOpen}
          onToggleOther={() => setShowOtherDate((open) => !open)}
        />
        {otherDateOpen && (
          <label className="field">
            <span className="label">{t('otherDate')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
        {dateNotes}
        <button type="button" className="btn" onClick={() => setSheet(null)}>
          {t('done')}
        </button>
      </Sheet>

      <Sheet open={sheet === 'options'} onClose={() => setSheet(null)} title={t('moreOptions')}>
        {showToSavings ? (
          <label className="field">
            <span className="label">{t('toSavingsOptional')}</span>
            <input
              type="text"
              inputMode="decimal"
              value={toSavingsText}
              onChange={(e) => setToSavingsText(e.target.value)}
            />
          </label>
        ) : (
          <p className="sub">{t('optionsOnlyIncome')}</p>
        )}
        {showToSavings && !toSavingsValid && (
          <p className="field-note error" role="alert">{t('toSavingsInvalid')}</p>
        )}
        <p className="sub">{t('noteHint')}</p>
        <button type="button" className="btn" onClick={() => setSheet(null)}>
          {t('done')}
        </button>
      </Sheet>
    </>
  )
}
