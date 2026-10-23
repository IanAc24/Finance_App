import { useState } from 'react'
import { Link } from 'react-router-dom'
import { categoryColor, categoryLabel } from '../../lib/categories'
import { getQuincenaRange, parseDate } from '../../lib/dates'
import { currencies, formatMoney, parseAmount, sum } from '../../lib/money'
import { getCategoryTotals } from '../../lib/stats'
import { useToday } from '../../lib/useToday'
import { useSettings } from '../../context/useSettings'
import { useToast } from '../../context/useToast'
import { useTransactions } from '../../context/useTransactions'
import CategoryIcon from '../../components/CategoryIcon'
import CurrencyPills from '../../components/CurrencyPills'

function BudgetForm({ currency }) {
  const { t } = useSettings()
  const toast = useToast()
  const { categories, budgets, transactions, quincenaSchedule, setBudget } =
    useTransactions()
  const today = useToday()
  const { symbol } = currencies.find((c) => c.code === currency)

  const current = (categoryId) =>
    budgets.find((b) => b.categoryId === categoryId && b.currency === currency)
      ?.amount ?? 0

  // what each category has spent in this quincena, in this currency
  const { start, end } = getQuincenaRange(today, quincenaSchedule)
  const spentByCategory = getCategoryTotals(
    transactions.filter((tx) => {
      const date = parseDate(tx.date)
      return (
        tx.type === 'expense' &&
        tx.currency === currency &&
        date >= start &&
        date <= end
      )
    }),
    categories,
  )
  const spentOf = (categoryId) =>
    spentByCategory.find((item) => item.category.id === categoryId)?.total ?? 0

  const [texts, setTexts] = useState(() =>
    Object.fromEntries(
      categories.map((c) => [c.id, current(c.id) > 0 ? String(current(c.id)) : '']),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const invalid = categories.some((c) => parseAmount(texts[c.id] ?? '') === null)

  const handleChange = (id, value) => {
    setTexts((prev) => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    if (saving || invalid) return
    setSaving(true)
    setSaveError(false)
    try {
      for (const c of categories) {
        const value = parseAmount(texts[c.id] ?? '')
        if (value !== current(c.id)) await setBudget(c.id, currency, value)
      }
      setSaving(false)
      toast.show({ message: t('saved') })
    } catch (error) {
      console.error(error)
      setSaving(false)
      setSaveError(true)
    }
  }

  // the state of a saved budget, in words (the bar only repeats it)
  const stateOf = (spent, limit) => {
    const ratio = spent / limit
    if (ratio >= 1) {
      return {
        kind: 'over',
        text: t('overBudgetBy').replace(
          '{amount}',
          formatMoney(sum([spent, -limit]), currency),
        ),
      }
    }
    if (ratio >= 0.8) {
      return { kind: 'near', text: `${Math.round(ratio * 100)}% ${t('ofBudget')}` }
    }
    return {
      kind: 'ok',
      text: t('budgetLeft').replace('{amount}', formatMoney(sum([limit, -spent]), currency)),
    }
  }

  return (
    <>
      <section className="card">
        <ul className="list">
          {categories.map((c) => {
            const limit = current(c.id)
            const spent = spentOf(c.id)
            const state = limit > 0 ? stateOf(spent, limit) : null
            let barColor = categoryColor(c)
            if (state?.kind === 'over') barColor = 'var(--danger)'
            else if (state?.kind === 'near') barColor = 'var(--warning)'

            return (
              <li key={c.id}>
                <div className="tx-row">
                  <CategoryIcon category={c} />
                  <span className="tx-text">
                    <span className="tx-name">{categoryLabel(c, t)}</span>
                  </span>
                  <span className="budget-field">
                    <span className="budget-symbol" aria-hidden="true">
                      {symbol}
                    </span>
                    <input
                      className="budget-input"
                      type="text"
                      inputMode="decimal"
                      placeholder={t('noLimit')}
                      aria-label={categoryLabel(c, t)}
                      value={texts[c.id] ?? ''}
                      onChange={(e) => handleChange(c.id, e.target.value)}
                    />
                  </span>
                </div>
                {state && (
                  <div className="budget-state">
                    <div className="mini-bar" aria-hidden="true">
                      <div
                        style={{
                          width: `${Math.min(spent / limit, 1) * 100}%`,
                          background: barColor,
                        }}
                      />
                    </div>
                    <p className="budget-note">
                      {t('budgetSpentOf')
                        .replace('{spent}', formatMoney(spent, currency))
                        .replace('{limit}', formatMoney(limit, currency))}
                    </p>
                    <p
                      className={
                        state.kind === 'ok'
                          ? 'budget-note'
                          : `budget-note ${state.kind}`
                      }
                    >
                      {state.text}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {invalid && <p className="field-note error" role="alert">{t('invalidAmount')}</p>}
      {saveError && <p className="field-note error" role="alert">{t('saveError')}</p>}

      <button
        type="button"
        className="btn"
        disabled={saving || invalid}
        onClick={handleSave}
      >
        {saving ? t('saving') : t('save')}
      </button>
    </>
  )
}

export default function BudgetsScreen() {
  const { t } = useSettings()
  const [currency, setCurrency] = useState('CRC')

  return (
    <>
      <Link className="back-link" to="/settings">
        ‹ {t('settings')}
      </Link>
      <h1 className="screen-title">{t('budgets')}</h1>
      <p className="sub">{t('budgetHint')}</p>

      <div className="narrow">
        <div className="center-pills">
          <CurrencyPills value={currency} onChange={setCurrency} />
        </div>

        <BudgetForm key={currency} currency={currency} />
      </div>
    </>
  )
}
