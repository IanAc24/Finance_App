import { useState } from 'react'
import { byNewest, getQuincenaRange, parseDate, todayString } from '../../lib/dates'
import { dateWithYear, deleteMessage, signedAmount } from '../../lib/describe'
import { formatDate } from '../../lib/format'
import { MAX_NOTE_LENGTH } from '../../lib/limits'
import { currencies, formatMoney, parseAmount } from '../../lib/money'
import { availableForSavings, quincenaFigures } from '../../lib/quincena'
import { savingsBalance, savingsInRange } from '../../lib/savings'
import { useToday } from '../../lib/useToday'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import CategoryIcon from '../../components/CategoryIcon'
import SubHeader from '../../components/SubHeader'
import CurrencyPills from '../../components/CurrencyPills'
import EmptyState from '../../components/EmptyState'
import Money from '../../components/Money'

export default function SavingsScreen() {
  const { locale, t } = useSettings()
  const { confirm } = useDialog()
  const {
    transactions,
    savings,
    recurring,
    quincenaSchedule,
    profile,
    addSavingsMove,
    deleteSavingsMove,
  } = useTransactions()
  const today = useToday()

  const [currency, setCurrency] = useState(profile.currency)
  const [amountText, setAmountText] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  // the button the person last pointed at or focused: when both directions
  // lack funds, only the warning of this one shows
  const [direction, setDirection] = useState('in')

  const amount = parseAmount(amountText)
  const amountValid = amount !== null && amount > 0
  const balance = savingsBalance(savings, currency)
  // taking out cannot exceed what is saved; putting in cannot exceed what is
  // in hand this quincena (income dated after today is not yet money)
  const tooMuch = amountValid && amount > balance
  const available = availableForSavings(
    quincenaFigures(
      { transactions, savings, recurring, quincenaSchedule },
      currency,
      today,
    ),
  )
  const tooMuchToSave = amountValid && amount > available
  const canMove = amountValid && !saving
  // one "not enough" warning at a time: the only one that applies, or the one
  // of the chosen direction when both do
  const warning =
    tooMuchToSave && tooMuch ? (direction === 'in' ? 'save' : 'take')
      : tooMuchToSave ? 'save'
        : tooMuch ? 'take'
          : null

  const move = async (direction) => {
    if (!canMove) return
    setSaving(true)
    setSaveError(false)
    try {
      await addSavingsMove({
        amount,
        currency,
        direction,
        note: note.trim(),
        date: todayString(),
      })
      setAmountText('')
      setNote('')
      setSaving(false)
    } catch (error) {
      console.error(error)
      setSaving(false)
      setSaveError(true)
    }
  }

  // the name a movement shows: its note, or what kind of move it was
  const moveName = (item) =>
    item.note ||
    (item.direction === 'in' ? t('moveToSavings') : t('takeFromSavings'))

  // deleting an old move is how a mistake is corrected, so the balance may
  // go below zero
  const handleDelete = async (item) => {
    if (saving) return
    const { confirmed } = await confirm({
      message: deleteMessage(t('confirmDeleteMove'), {
        name: moveName(item),
        amount: signedAmount(
          item.direction === 'in' ? '+' : '−',
          item.amount,
          item.currency,
        ),
        date: dateWithYear(parseDate(item.date), today, locale),
      }),
      confirmLabel: t('delete'),
      danger: true,
    })
    if (!confirmed) return
    setSaving(true)
    setSaveError(false)
    try {
      await deleteSavingsMove(item.id)
    } catch (error) {
      console.error(error)
      setSaveError(true)
    }
    setSaving(false)
  }

  const sorted = [...savings].sort(byNewest)

  // the goal from the welcome, in its currency, against this quincena
  const goalCode = profile.currency
  const { start, end } = getQuincenaRange(today, quincenaSchedule)
  const savedNow = savingsInRange(savings, goalCode, start, end).toSavings

  return (
    <>
      <SubHeader to="/settings" backLabel={t('settings')} title={t('savings')} />
      <p className="sub">{t('savingsHint')}</p>

      <div className="narrow">
        <section className="summary">
          {currencies.map(({ code, labelKey }) => (
            <div className="savings-balance" key={code}>
              <p className="sub">{t(labelKey)}</p>
              <Money text={formatMoney(savingsBalance(savings, code), code)} />
            </div>
          ))}
          {profile.savingsGoal && (
            <ul className="list summary-where">
              <li className="row">
                <span className="row-name">{t('savingsGoalPerQuincena')}</span>
                <span className="row-amount">
                  {formatMoney(profile.savingsGoal, goalCode)}
                </span>
              </li>
              <li className="row">
                <span className="row-name">{t('savedThisQuincena')}</span>
                <span className="row-amount">{formatMoney(savedNow, goalCode)}</span>
              </li>
            </ul>
          )}
        </section>

        <section className="card">
          <CurrencyPills value={currency} onChange={setCurrency} />

          <label className="field">
            <span className="label">{t('amount')}</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </label>
          {amountText.trim() !== '' && !amountValid && (
            <p className="field-note error" role="alert">{t('invalidAmount')}</p>
          )}
          {warning === 'save' && (
            <p className="field-note warning savings-warning" role="status">
              {t('notEnoughAvailable')} {formatMoney(available, currency)}
            </p>
          )}
          {warning === 'take' && (
            <p className="field-note warning savings-warning" role="status">
              {t('notEnoughSavings')} {formatMoney(balance, currency)}
            </p>
          )}

          <label className="field">
            <span className="label">{t('note')}</span>
            <input
              type="text"
              autoComplete="off"
              aria-describedby="note-hint"
              value={note}
              maxLength={MAX_NOTE_LENGTH}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="sub note-hint" id="note-hint">
            {t('noteHint')}
          </p>

          {saveError && <p className="field-note error" role="alert">{t('saveError')}</p>}

          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={!canMove || tooMuchToSave}
              onFocus={() => setDirection('in')}
              onPointerEnter={() => setDirection('in')}
              onClick={() => move('in')}
            >
              {t('moveToSavings')}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={!canMove || tooMuch}
              onFocus={() => setDirection('out')}
              onPointerEnter={() => setDirection('out')}
              onClick={() => move('out')}
            >
              {t('takeFromSavings')}
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">{t('movements')}</h2>
          {sorted.length === 0 ? (
            <EmptyState actions={false} illustration="piggy" text={t('noSavingsYet')} />
          ) : (
            <ul className="list">
              {sorted.map((item) => (
                <li key={item.id}>
                  <div className="tx-row">
                    <CategoryIcon kind={item.direction === 'in' ? 'savings' : 'savingsOut'} />
                    <span className="tx-text">
                      <span className="tx-name">
                        {moveName(item)}
                      </span>
                      <span className="tx-meta">
                        {formatDate(parseDate(item.date), locale)}
                      </span>
                    </span>
                    <span className="tx-amount">
                      {item.direction === 'in' ? '+' : '−'}
                      {formatMoney(item.amount, item.currency)}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="pill"
                      disabled={saving}
                      onClick={() => handleDelete(item)}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
