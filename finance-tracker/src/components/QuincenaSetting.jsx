import { useState } from 'react'
import { useSettings } from '../context/useSettings'
import { useTransactions } from '../context/useTransactions'
import { formatDate } from '../lib/format'
import { parseDate, todayString } from '../lib/dates'
import {
  changeSchedule,
  describeSchedule,
  registerPayday,
} from '../lib/quincenaSchedule'
import { useToday } from '../lib/useToday'

// Days typed in the boxes: whole numbers 1-31, the second one may be empty
const toDay = (text) => (/^\d{1,2}$/.test(text) ? Number(text) : null)
const isDay = (day) => day !== null && day >= 1 && day <= 31

const PAID_ERRORS = {
  invalid: 'quincenaPaidInvalid',
  early: 'quincenaPaidEarly',
}

// What the boxes say as a choice for the schedule, or null while they are
// not valid. For 'manual', `paidOn` is the day the person was paid; the
// caller says whether the rules for a person with data apply (hasData).
function toChoice(mode, day1, day2, paidOn, today, hasData, schedule) {
  if (mode === 'fixed') return { mode: 'fixed' }
  if (mode === 'manual') {
    const result = registerPayday(schedule, paidOn, today)
    // a person with no data has no past to protect: "early" does not matter
    return result.ok || (!hasData && result.reason === 'early')
      ? { mode: 'manual', from: paidOn }
      : null
  }
  const first = toDay(day1)
  const second = day2 === '' ? null : toDay(day2)
  const valid = isDay(first) && (day2 === '' || isDay(second)) && second !== first
  return valid ? { mode: 'paydays', day1: first, day2: second } : null
}

// How the quincena is cut. In Settings it is a card with its own Save button:
// the change takes effect when the quincena in progress ends, and what is
// already registered is never moved (a manual "I was paid" date starts the
// new quincena on that day, inside the one in progress). With `embedded` (the
// welcome steps) it has no card or Save button and reports each choice
// through onChange (the choice, or null while it is not valid); the welcome
// saves it, and `initial` is the choice to show when the step is opened again.
export default function QuincenaSetting({ embedded = false, initial, onChange }) {
  const { locale, t } = useSettings()
  const { quincenaSchedule, saveQuincenaSchedule, transactions, savings, recurring } =
    useTransactions()
  const today = useToday()
  const { current, pending } = describeSchedule(quincenaSchedule, today)
  // embedded: start from the choice already made in the welcome, if any
  const shown = (embedded && initial) || pending || current
  const hasData =
    transactions.length > 0 || savings.length > 0 || recurring.length > 0

  const [mode, setMode] = useState(shown.mode)
  // the boxes start with the days of the schedule in use when it is already
  // "my pay days"; otherwise with the usual 15 and 30
  const [day1, setDay1] = useState(String(shown.mode === 'paydays' ? shown.day1 : 15))
  const [day2, setDay2] = useState(
    shown.mode === 'paydays' ? String(shown.day2 ?? '') : '30',
  )
  // the day the person was paid (manual): today unless the welcome had one
  const [paidOn, setPaidOn] = useState(
    embedded && initial?.mode === 'manual' ? initial.from : todayString(today),
  )
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const first = toDay(day1)
  const second = day2 === '' ? null : toDay(day2)
  const daysValid =
    isDay(first) && (day2 === '' || isDay(second)) && second !== first
  const paid = registerPayday(quincenaSchedule, paidOn, today)
  const valid = mode === 'fixed' || (mode === 'manual' ? paid.ok : daysValid)
  let next = quincenaSchedule
  if (mode === 'manual') {
    if (paid.ok) next = paid.schedule
  } else if (valid) {
    next = changeSchedule(
      quincenaSchedule,
      mode === 'fixed' ? { mode: 'fixed' } : { mode, day1: first, day2: second },
      today,
    )
  }
  const changed = JSON.stringify(next) !== JSON.stringify(quincenaSchedule)
  const canSave = !busy && valid && changed

  const describe = (entry) => {
    if (entry.mode === 'fixed') return t('quincenaMode15')
    if (entry.mode === 'manual') {
      return `${t('quincenaModeManual')}: ${formatDate(parseDate(entry.from), locale)}`
    }
    return `${t('quincenaPayDays')}: ${[entry.day1, entry.day2].filter(Boolean).join(' · ')}`
  }

  const handleSave = async () => {
    if (!canSave) return
    setBusy(true)
    setFailed(false)
    try {
      await saveQuincenaSchedule(next)
    } catch (error) {
      console.error(error)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const report = (nextMode, nextDay1, nextDay2, nextPaidOn) =>
    onChange?.(
      toChoice(nextMode, nextDay1, nextDay2, nextPaidOn, today, hasData, quincenaSchedule),
    )

  const chooseMode = (nextMode) => {
    setMode(nextMode)
    report(nextMode, day1, day2, paidOn)
  }

  const digits = (setter, which) => (e) => {
    const text = e.target.value.replace(/\D/g, '').slice(0, 2)
    setter(text)
    report(mode, which === 1 ? text : day1, which === 2 ? text : day2, paidOn)
  }

  const changePaidOn = (e) => {
    setPaidOn(e.target.value)
    report(mode, day1, day2, e.target.value)
  }

  // in the welcome of a person with no data only "not in the future" matters
  const paidFine = paid.ok || (embedded && !hasData && paid.reason === 'early')
  const paidError = mode === 'manual' && !paidFine ? paid.reason : null

  const Wrapper = embedded ? 'div' : 'section'

  return (
    <Wrapper className={embedded ? 'quincena-embedded' : 'card'}>
      {!embedded && <h2 className="section-title">{t('quincenaSetting')}</h2>}
      {!embedded && <p className="sub">{describe(current)}</p>}
      {!embedded && pending && (
        <p className="sub">
          {t('quincenaPending')} {formatDate(parseDate(pending.from), locale)}:{' '}
          {describe(pending)}
        </p>
      )}

      <div className="pill-group wrap" role="group" aria-label={t('quincenaSetting')}>
        <button
          type="button"
          className={mode === 'fixed' ? 'pill active' : 'pill'}
          aria-pressed={mode === 'fixed'}
          onClick={() => chooseMode('fixed')}
        >
          {t('quincenaMode15')}
        </button>
        <button
          type="button"
          className={mode === 'paydays' ? 'pill active' : 'pill'}
          aria-pressed={mode === 'paydays'}
          onClick={() => chooseMode('paydays')}
        >
          {t('quincenaModePaydays')}
        </button>
        <button
          type="button"
          className={mode === 'manual' ? 'pill active' : 'pill'}
          aria-pressed={mode === 'manual'}
          onClick={() => chooseMode('manual')}
        >
          {t('quincenaModeManual')}
        </button>
      </div>

      {mode === 'paydays' && (
        <>
          <label className="field">
            <span className="label">{t('quincenaDay1')}</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={day1}
              aria-invalid={!daysValid}
              aria-describedby={!daysValid ? 'quincena-days-error' : undefined}
              onChange={digits(setDay1, 1)}
            />
          </label>
          <label className="field">
            <span className="label">{t('quincenaDay2')}</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={day2}
              aria-invalid={!daysValid}
              aria-describedby={!daysValid ? 'quincena-days-error' : undefined}
              onChange={digits(setDay2, 2)}
            />
          </label>
          {!daysValid && (
            <p className="field-note error" role="alert" id="quincena-days-error">
              {t('quincenaDaysInvalid')}
            </p>
          )}
          <p className="field-note">{t('quincenaMonthEnd')}</p>
        </>
      )}

      {mode === 'manual' && (
        <>
          <label className="field">
            <span className="label">{t('quincenaPaidOn')}</span>
            <input
              type="date"
              value={paidOn}
              aria-invalid={paidError !== null}
              aria-describedby={paidError ? 'quincena-paid-error' : undefined}
              onChange={changePaidOn}
            />
          </label>
          {paidError && (
            <p className="field-note error" role="alert" id="quincena-paid-error">
              {t(PAID_ERRORS[paidError])}
            </p>
          )}
          <p className="field-note">{t('quincenaManualNote')}</p>
        </>
      )}

      {!embedded && (
        <>
          {mode !== 'manual' && <p className="field-note">{t('quincenaForward')}</p>}
          {failed && (
            <p className="field-note error" role="alert">
              {t('saveError')}
            </p>
          )}
          <div className="actions">
            <button type="button" className="btn" disabled={!canSave} onClick={handleSave}>
              {t('save')}
            </button>
          </div>
        </>
      )}
    </Wrapper>
  )
}
