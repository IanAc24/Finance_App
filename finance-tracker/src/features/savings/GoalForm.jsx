import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../../context/useSettings'
import { newId } from '../../lib/ids'
import { MAX_GOAL_NAME_LENGTH } from '../../lib/limits'
import { currencies, parseAmount } from '../../lib/money'
import { amountMessage, amountProblem, fillTemplate } from '../../lib/savingsUi'
import Spinner from './Spinner'

// The form inside the sheet that creates or edits a savings goal (name up to
// 40 characters, target above zero) in one currency. Same rules as the move
// form: one id per creation kept in a ref, a double press is ignored, an
// error keeps what was typed.
//   goal: the goal being edited, or null to create one
//   onSubmit({ id, name, target }): resolves when answered, rejects on failure
export default function GoalForm({ goal, currency, onSubmit, onDone }) {
  const { t } = useSettings()
  const [name, setName] = useState(goal?.name ?? '')
  const [targetText, setTargetText] = useState(goal ? String(goal.target).replace('.', ',') : '')
  const [tried, setTried] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)

  const nameRef = useRef(null)
  const targetRef = useRef(null)
  const idRef = useRef(goal?.id ?? null)
  const busyRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 30)
    return () => clearTimeout(timer)
  }, [])

  const nameEmpty = name.trim() === ''
  const problem = amountProblem(targetText, { direction: 'in', balance: 0, currency })
  const label = currencies.find((c) => c.code === currency)

  const submit = async (event) => {
    event.preventDefault()
    if (busyRef.current) return
    setTried(true)
    if (nameEmpty) {
      nameRef.current?.focus()
      return
    }
    if (problem) {
      targetRef.current?.focus()
      return
    }
    busyRef.current = true
    setSubmitting(true)
    setFailed(false)
    if (idRef.current === null) idRef.current = newId()
    try {
      await onSubmit({ id: idRef.current, name: name.trim(), target: parseAmount(targetText) })
      onDone()
    } catch (error) {
      console.error(error)
      setFailed(true)
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
        <span className="label">{t('svGoalName')}</span>
        <input
          ref={nameRef}
          type="text"
          autoComplete="off"
          value={name}
          maxLength={MAX_GOAL_NAME_LENGTH}
          aria-invalid={tried && nameEmpty ? true : undefined}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {tried && nameEmpty && (
        <p className="field-note error" role="alert">
          {t('svGoalNameEmpty')}
        </p>
      )}

      <label className="field">
        <span className="label">{t('svGoalTarget')}</span>
        <input
          ref={targetRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={targetText}
          aria-invalid={problem && (tried || targetText.trim() !== '') ? true : undefined}
          onChange={(event) => setTargetText(event.target.value)}
        />
      </label>
      {problem && (tried || (targetText.trim() !== '' && problem !== 'empty')) && (
        <p className="field-note error" role="alert">
          {amountMessage(t, problem, { currency, balance: 0 })}
        </p>
      )}

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
          ) : (
            t('save')
          )}
        </button>
      </div>
    </form>
  )
}
