import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import CurrencyPills from '../../components/CurrencyPills'
import LanguageSwitch from '../../components/LanguageSwitch'
import Illustration from '../../components/Illustration'
import Logo from '../../components/Logo'
import Money from '../../components/Money'
import QuincenaSetting from '../../components/QuincenaSetting'
import { formatMoney, currencies } from '../../lib/money'
import { categoryLabel } from '../../lib/categories'
import {
  MAX_CATEGORY_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_PROFILE_NAME_LENGTH,
} from '../../lib/limits'
import {
  BILLS_CATEGORY_ID,
  NEW_CATEGORY,
  buildFixedExpense,
  cleanName,
  freePerQuincena,
  optionalAmount,
  planIncome,
  quincenasPerMonth,
  scheduleForOnboarding,
} from '../../lib/onboarding'
import { describeSchedule, normalizeSchedule } from '../../lib/quincenaSchedule'
import { scheduleKey, schedules } from '../../lib/recurring'
import { useToday } from '../../lib/useToday'

const STEP_COUNT = 5
const LAST_STEP = STEP_COUNT - 1

// Free money per quincena, shown at the end of the fixed expenses step and of
// the goal step
function FreeSummary({ figures, hasIncome, currency }) {
  const { t } = useSettings()
  const negative = figures.free < 0
  return (
    <div className="ob-free">
      <p className="label">{t('obFreeLabel')}</p>
      {hasIncome ? (
        <>
          <p className={negative ? 'summary-amount is-muted' : 'summary-amount'}>
            <Money text={formatMoney(figures.free, currency)} />
          </p>
          {negative && <p className="sub warn">{t('obFreeNegative')}</p>}
          <p className="sub">{t('obFreeAverage')}</p>
        </>
      ) : (
        <p className="sub">{t('obFreeNeedIncome')}</p>
      )}
    </div>
  )
}

// The first-use screen: five short steps, all of them skippable. Nothing is
// saved until the end, when everything is written in one go. It is also what
// Settings > "Repeat initial setup" opens, over the data already there.
export default function OnboardingScreen() {
  const { t } = useSettings()
  const { confirm } = useDialog()
  const navigate = useNavigate()
  const today = useToday()
  const {
    profile,
    categories,
    recurring,
    transactions,
    savings,
    quincenaSchedule,
    repeatingOnboarding,
    completeOnboarding,
    skipOnboarding,
  } = useTransactions()

  const startName = profile.name
  const startCurrency = profile.currency
  const startIncome = profile.income ? String(profile.income) : ''
  const startGoal = profile.savingsGoal ? String(profile.savingsGoal) : ''

  const [step, setStep] = useState(0)
  const [name, setName] = useState(startName)
  const [currency, setCurrency] = useState(startCurrency)
  // undefined = leave the schedule as it is, null = days typed are not valid
  const [choice, setChoice] = useState(undefined)
  const [incomeText, setIncomeText] = useState(startIncome)
  const [expenses, setExpenses] = useState([])
  const [draftName, setDraftName] = useState('')
  const [draftAmount, setDraftAmount] = useState('')
  const [draftSchedule, setDraftSchedule] = useState('every')
  // an existing category id (as text) or NEW_CATEGORY
  const [draftCategory, setDraftCategory] = useState(String(BILLS_CATEGORY_ID))
  const [draftNewCategory, setDraftNewCategory] = useState('')
  const [draftError, setDraftError] = useState(null)
  const [goalText, setGoalText] = useState(startGoal)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // read out by screen readers when an expense is added or removed
  const [announce, setAnnounce] = useState('')

  const stepText = t('obStepOf')
    .replace('{n}', step + 1)
    .replace('{total}', STEP_COUNT)

  const heading = useRef(null)
  const draftNameInput = useRef(null)
  const draftCategoryInput = useRef(null)
  const draftAmountInput = useRef(null)
  const firstRender = useRef(true)
  const nextId = useRef(1)

  // each step puts the keyboard focus on its title (a screen reader reads it)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    heading.current?.focus()
  }, [step])

  const hasData =
    transactions.length > 0 || savings.length > 0 || recurring.length > 0
  const { current } = describeSchedule(quincenaSchedule, today)
  const effective = choice ?? current
  const perMonth = quincenasPerMonth(effective)
  // the names of "monthly" depend on how the quincena is cut
  const labelSchedule = choice
    ? normalizeSchedule([{ ...choice, from: '2000-01-01' }])
    : quincenaSchedule

  const income = optionalAmount(incomeText)
  const goal = optionalAmount(goalText)
  const symbol = currencies.find((c) => c.code === currency)?.symbol

  // expenses that already existed (a repeat) count too
  const existing = recurring.filter(
    (r) => r.type === 'expense' && r.currency === currency,
  )
  const figuresFor = (includeGoal) =>
    freePerQuincena({
      income: income ?? 0,
      expenses: [...existing, ...expenses],
      savingsGoal: includeGoal ? (goal ?? 0) : 0,
      perMonth,
    })

  const categoryName = (item) => {
    if (item.newCategory) return item.newCategory
    const category = categories.find((c) => c.id === item.categoryId)
    return category ? categoryLabel(category, t) : t('typeExpense')
  }

  const draftFilled = draftName.trim() !== '' || draftAmount.trim() !== ''

  // Adds the expense being typed to the list; false when it is not valid
  const addDraft = () => {
    const built = buildFixedExpense({
      name: draftName,
      amountText: draftAmount,
      schedule: draftSchedule,
      currency,
      categoryId:
        draftCategory === NEW_CATEGORY ? NEW_CATEGORY : Number(draftCategory),
      newCategoryName: draftNewCategory,
    })
    if (!built.ok) {
      setDraftError(built.reason)
      const field = {
        name: draftNameInput,
        amount: draftAmountInput,
        category: draftCategoryInput,
      }[built.reason]
      field.current?.focus()
      return false
    }
    setExpenses((list) => [...list, { ...built.item, id: nextId.current++ }])
    setAnnounce(`${t('obAdded')}: ${built.item.note}`)
    setDraftName('')
    setDraftAmount('')
    setDraftNewCategory('')
    setDraftError(null)
    draftNameInput.current?.focus()
    return true
  }

  // Amounts typed in one currency are not converted: changing the currency
  // clears what depends on it, so nothing is saved with the wrong currency
  const changeCurrency = (code) => {
    if (code === currency) return
    setCurrency(code)
    setExpenses([])
    setIncomeText('')
    setGoalText('')
  }

  const resetStep = () => {
    if (step === 0) {
      setName(startName)
      setCurrency(startCurrency)
    } else if (step === 1) {
      setChoice(undefined)
    } else if (step === 2) {
      setIncomeText(startIncome)
    } else if (step === 3) {
      setExpenses([])
      setDraftName('')
      setDraftAmount('')
      setDraftError(null)
    } else {
      setGoalText(startGoal)
    }
  }

  const canGoOn = [
    true,
    choice !== null,
    income !== undefined,
    true,
    goal !== undefined,
  ][step]

  // Writes everything at once. `skipGoal` is for skipping the last step,
  // which finishes straight away (the state would not be updated in time).
  const finish = async ({ skipGoal = false } = {}) => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      const typedGoal = skipGoal ? optionalAmount(startGoal) : goal
      const plan = planIncome({
        income: income ?? null,
        currency,
        note: t('obIncomeNote'),
        previous: profile.income
          ? { income: profile.income, currency: profile.currency }
          : null,
        recurring,
      })
      const add = expenses.map((item) => ({ ...item, id: undefined }))
      if (plan.action === 'add') add.unshift(plan.item)
      await completeOnboarding({
        profile: {
          name: cleanName(name),
          currency,
          income: income ?? null,
          savingsGoal: typedGoal ?? null,
        },
        schedule: choice
          ? scheduleForOnboarding(quincenaSchedule, choice, today, hasData)
          : null,
        add,
        update:
          plan.action === 'update' ? { id: plan.id, item: plan.item } : null,
      })
      navigate('/', { replace: true })
    } catch (error) {
      console.error(error)
      setFailed(true)
      setBusy(false)
    }
  }

  const goNext = () => {
    if (busy || !canGoOn) return
    // an expense typed but not added yet is not lost
    if (step === 3 && draftFilled && !addDraft()) return
    if (step === LAST_STEP) finish()
    else setStep(step + 1)
  }

  const skipStep = () => {
    if (busy) return
    resetStep()
    if (step === LAST_STEP) finish({ skipGoal: true })
    else setStep(step + 1)
  }

  const skipAll = async () => {
    if (busy) return
    // something typed would be lost: ask first
    const typed =
      name !== startName ||
      currency !== startCurrency ||
      choice !== undefined ||
      incomeText !== startIncome ||
      goalText !== startGoal ||
      expenses.length > 0
    if (typed) {
      const { confirmed } = await confirm({
        message: repeatingOnboarding ? t('obRepeatLeaveConfirm') : t('obSkipAllConfirm'),
        confirmLabel: repeatingOnboarding ? t('obRepeatLeave') : t('obSkipAll'),
        // the dialog's own Cancel button must not read "Cancel" twice
        cancelLabel: repeatingOnboarding ? t('obRepeatKeep') : undefined,
        danger: true,
      })
      if (!confirmed) return
    }
    setBusy(true)
    setFailed(false)
    try {
      await skipOnboarding()
      navigate('/', { replace: true })
    } catch (error) {
      console.error(error)
      setFailed(true)
      setBusy(false)
    }
  }

  const onDraftKey = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addDraft()
    }
  }

  const title = [
    t('obBasicsTitle'),
    t('obPaydayTitle'),
    t('obIncomeTitle'),
    t('obFixedTitle'),
    t('obGoalTitle'),
  ][step]

  return (
    <div className="onboarding">
      {step === 0 && <LanguageSwitch />}
      <div className="ob-brand">
        <Logo className="ob-logo" />
      </div>

      <div
        className="ob-progress"
        role="progressbar"
        aria-label={t('obProgress')}
        aria-valuemin={1}
        aria-valuemax={STEP_COUNT}
        aria-valuenow={step + 1}
        aria-valuetext={stepText}
      >
        <div
          className="ob-progress-fill"
          style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
        />
      </div>
      <p className="sub ob-step-count" aria-hidden="true">
        {stepText}
      </p>

      <section className="card ob-card">
        <Illustration
          key={step}
          name={['hello', 'payday', 'income', 'bills', 'piggy'][step]}
          size={88}
          className="ob-art"
        />
        <h1 className="screen-title ob-title" ref={heading} tabIndex={-1}>
          {title}
        </h1>

        {step === 0 && (
          <>
            <p className="sub">{t('obBasicsHint')}</p>
            <label className="field">
              <span className="label">{t('obName')}</span>
              <input
                type="text"
                autoComplete="given-name"
                maxLength={MAX_PROFILE_NAME_LENGTH}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div role="group" aria-labelledby="ob-currency-label">
              <p className="label" id="ob-currency-label">
                {t('obCurrency')}
              </p>
              <CurrencyPills value={currency} onChange={changeCurrency} />
            </div>
            <p className="field-note">{t('obCurrencyWarn')}</p>
          </>
        )}

        {step === 1 && (
          <>
            <p className="sub">{t('obPaydayHint')}</p>
            <QuincenaSetting embedded initial={choice} onChange={setChoice} />
          </>
        )}

        {step === 2 && (
          <>
            <p className="sub">{t('obIncomeHint')}</p>
            <label className="field">
              <span className="label">
                {t('obIncomeLabel')} ({symbol})
              </span>
              <input
                type="text"
                inputMode="decimal"
                aria-invalid={income === undefined}
                aria-describedby={income === undefined ? 'ob-income-error' : undefined}
                value={incomeText}
                onChange={(e) => setIncomeText(e.target.value)}
              />
            </label>
            {income === undefined && (
              <p className="field-note error" role="alert" id="ob-income-error">
                {t('invalidAmount')}
              </p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="sub">{t('obFixedHint')}</p>

            {existing.length > 0 && (
              <>
                <p className="label">{t('obAlreadyHad')}</p>
                <ul className="list ob-list">
                  {existing.map((item) => (
                    <li key={item.id} className="row">
                      <span className="row-name">{item.note}</span>
                      <span className="row-amount">
                        {formatMoney(item.amount, item.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {expenses.length === 0 && existing.length === 0 ? (
              <p className="sub empty">{t('obNoExpenses')}</p>
            ) : (
              <ul className="list ob-list">
                {expenses.map((item) => (
                  <li key={item.id} className="row">
                    <div>
                      <p className="row-name">{item.note}</p>
                      <p className="row-meta">
                        {categoryName(item)} ·{' '}
                        {t(scheduleKey(item.schedule, labelSchedule, today))}
                      </p>
                    </div>
                    <div className="row-side">
                      <p className="row-amount spending">
                        {formatMoney(item.amount, currency)}
                      </p>
                      <button
                        type="button"
                        className="pill"
                        aria-label={`${t('obRemove')}: ${item.note}`}
                        onClick={() => {
                          setExpenses((list) =>
                            list.filter((other) => other.id !== item.id),
                          )
                          setAnnounce(`${t('obRemoved')}: ${item.note}`)
                          draftNameInput.current?.focus()
                        }}
                      >
                        {t('obRemove')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="ob-add">
              <label className="field">
                <span className="label">{t('obExpenseName')}</span>
                <input
                  ref={draftNameInput}
                  type="text"
                  maxLength={MAX_NOTE_LENGTH}
                  aria-invalid={draftError === 'name'}
                  aria-describedby={draftError === 'name' ? 'ob-draft-error' : undefined}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={onDraftKey}
                />
              </label>
              <label className="field">
                <span className="label">
                  {t('obExpenseAmount')} ({symbol})
                </span>
                <input
                  ref={draftAmountInput}
                  type="text"
                  inputMode="decimal"
                  aria-invalid={draftError === 'amount'}
                  aria-describedby={draftError === 'amount' ? 'ob-draft-error' : undefined}
                  value={draftAmount}
                  onChange={(e) => setDraftAmount(e.target.value)}
                  onKeyDown={onDraftKey}
                />
              </label>
              <label className="field">
                <span className="label">{t('category')}</span>
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryLabel(c, t)}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY}>{t('obNewCategory')}</option>
                </select>
              </label>
              {draftCategory === NEW_CATEGORY && (
                <label className="field">
                  <span className="label">{t('obNewCategoryName')}</span>
                  <input
                    ref={draftCategoryInput}
                    type="text"
                    maxLength={MAX_CATEGORY_NAME_LENGTH}
                    aria-invalid={draftError === 'category'}
                    aria-describedby={
                      draftError === 'category' ? 'ob-draft-error' : undefined
                    }
                    value={draftNewCategory}
                    onChange={(e) => setDraftNewCategory(e.target.value)}
                    onKeyDown={onDraftKey}
                  />
                </label>
              )}
              <p className="label" id="ob-repeats-label">
                {t('obExpenseRepeats')}
              </p>
              <div
                className="pill-group wrap"
                role="group"
                aria-labelledby="ob-repeats-label"
              >
                {schedules.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={draftSchedule === s ? 'pill active' : 'pill'}
                    aria-pressed={draftSchedule === s}
                    onClick={() => setDraftSchedule(s)}
                  >
                    {t(scheduleKey(s, labelSchedule, today))}
                  </button>
                ))}
              </div>
              {draftError === 'name' && (
                <p className="field-note error" role="alert" id="ob-draft-error">
                  {t('obExpenseNameInvalid')}
                </p>
              )}
              {draftError === 'category' && (
                <p className="field-note error" role="alert" id="ob-draft-error">
                  {t('obCategoryInvalid')}
                </p>
              )}
              {draftError === 'amount' && (
                <p className="field-note error" role="alert" id="ob-draft-error">
                  {t('invalidAmount')}
                </p>
              )}
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={addDraft}
              >
                {t('obAddExpense')}
              </button>
            </div>

            <p className="sr-only" role="status">
              {announce}
            </p>
            <FreeSummary
              figures={figuresFor(false)}
              hasIncome={income !== null && income !== undefined}
              currency={currency}
            />
          </>
        )}

        {step === 4 && (
          <>
            <p className="sub">{t('obGoalHint')}</p>
            <label className="field">
              <span className="label">
                {t('obGoalLabel')} ({symbol})
              </span>
              <input
                type="text"
                inputMode="decimal"
                aria-invalid={goal === undefined}
                aria-describedby={goal === undefined ? 'ob-goal-error' : undefined}
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
              />
            </label>
            {goal === undefined && (
              <p className="field-note error" role="alert" id="ob-goal-error">
                {t('invalidAmount')}
              </p>
            )}
            <FreeSummary
              figures={figuresFor(true)}
              hasIncome={income !== null && income !== undefined}
              currency={currency}
            />
          </>
        )}

        {failed && (
          <p className="field-note error" role="alert">
            {t('saveError')}
          </p>
        )}

        <div className="actions ob-nav">
          <button
            type="button"
            className="btn"
            disabled={busy || !canGoOn}
            onClick={goNext}
          >
            {busy ? t('obSaving') : step === LAST_STEP ? t('obFinish') : t('obNext')}
          </button>
          <div className="ob-nav-row">
            {step > 0 && (
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setStep(step - 1)}
              >
                {t('obBack')}
              </button>
            )}
            <button
              type="button"
              className="text-link ob-skip-step"
              disabled={busy}
              onClick={skipStep}
            >
              {step === LAST_STEP ? t('obSkipGoal') : t('obSkip')}
            </button>
          </div>
        </div>
      </section>

      <p className="ob-skip-all">
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={skipAll}
        >
          {repeatingOnboarding ? t('cancel') : t('obSkipAll')}
        </button>
      </p>
    </div>
  )
}
