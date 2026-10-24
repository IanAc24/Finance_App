import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../../context/useSettings'
import { todayString } from '../../lib/dates'
import { newId } from '../../lib/ids'
import { MAX_NOTE_LENGTH } from '../../lib/limits'
import { currencies, parseAmount } from '../../lib/money'
import { amountMessage, amountProblem, dateProblem, fillTemplate } from '../../lib/savingsUi'
import Spinner from './Spinner'

// The form inside the sheet that deposits to / withdraws from savings, in the
// currency on view. It mounts fresh every time the sheet opens.
//
// The id of the move is made ONCE (at the first try) and kept in a ref, so a
// retry after an error rewrites the same record instead of adding a second
// one. While the answer is awaited the button is disabled and shows a
// spinner; a second press (or a double click) is ignored synchronously. On an
// error the form keeps everything the person typed.
//   onSubmit(move): resolves when the save was answered, rejects when it failed
//   onDone(): closes the sheet
export default function MoveForm({ direction, currency, balance, today, onSubmit, onDone }) {
  const { t } = useSettings()
  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState(() => todayString(today))
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  // a withdrawal refused by the write itself (the balance changed meanwhile)
  const [refused, setRefused] = useState(false)

  const amountRef = useRef(null)
  const idRef = useRef(null)
  const busyRef = useRef(false)

  // the dialog is opened by the sheet after this mounts: focus the amount after
  useEffect(() => {
    const timer = setTimeout(() => amountRef.current?.focus(), 30)
    return () => clearTimeout(timer)
  }, [])

  const problem = refused ? 'aboveBalance' : amountProblem(amountText, { direction, balance })
  // "nothing typed" is only an error once the person tried to send
  const showProblem = problem && (tried || (amountText.trim() !== '' && problem !== 'empty'))
  const dateIssue = dateProblem(date, today)
  const label = currencies.find((c) => c.code === currency)

  const submit = async (event) => {
    event.preventDefault()
    if (busyRef.current) return
    setTried(true)
    if (problem || dateIssue) {
      if (problem) amountRef.current?.focus()
      return
    }
    busyRef.current = true
    setSubmitting(true)
    setFailed(false)
    if (idRef.current === null) idRef.current = newId()
    try {
      await onSubmit({
        id: idRef.current,
        amount: parseAmount(amountText),
        currency,
        direction,
        note: note.trim(),
        date,
      })
      onDone()
    } catch (error) {
      if (error?.code === 'insufficientSavings') {
        setRefused(true)
      } else {
        console.error(error)
        setFailed(true)
      }
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <form className="sv-form" onSubmit={submit} noValidate>
      <p className="sub">
        {fillTemplate(t('svInCurrency'), { currency: `${label.symbol} ${t(label.labelKey)}` })}
      </p>

      <label className="field">
        <span className="label">{t('amount')}</span>
        <input
          ref={amountRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amountText}
          aria-invalid={showProblem ? true : undefined}
          aria-describedby={showProblem ? 'sv-amount-msg' : undefined}
          onChange={(event) => {
            setAmountText(event.target.value)
            setRefused(false)
          }}
        />
      </label>
      {showProblem && (
        <p className="field-note error" id="sv-amount-msg" role="alert">
          {amountMessage(t, problem, { currency, balance })}
        </p>
      )}

      <label className="field">
        <span className="label">{t('date')}</span>
        <input
          type="date"
          value={date}
          max={todayString(today)}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      {tried && dateIssue && (
        <p className="field-note error" role="alert">
          {dateIssue === 'future' ? t('svDateFuture') : t('svDateInvalid')}
        </p>
      )}

      <label className="field">
        <span className="label">{t('note')}</span>
        <input
          type="text"
          autoComplete="off"
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {failed && (
        <p className="field-note error" role="alert">
          {t('saveError')}
        </p>
      )}

      <div className="sheet-actions">
        <button type="submit" className="btn" disabled={submitting} aria-busy={submitting}>
          {submitting ? (
            <span className="sv-busy">
              <Spinner />
              {t('saving')}
            </span>
          ) : direction === 'in' ? (
            t('svDeposit')
          ) : (
            t('svWithdraw')
          )}
        </button>
      </div>
    </form>
  )
}
