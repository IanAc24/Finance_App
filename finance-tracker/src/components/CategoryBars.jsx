import { useState } from 'react'
import { categoryColor, categoryLabel } from '../lib/categories'
import { formatMoney, sum } from '../lib/money'
import { budgetPercent, shareText } from '../lib/moneyDisplay'
import { pickCategoryRows } from '../lib/stats'
import { useSettings } from '../context/useSettings'
import CategoryIcon from './CategoryIcon'

// One row per category: icon, name, its share of the spending and the amount.
// totals is a list of { category, total }. The shares are of THIS list only, so
// the caller passes the spending of one currency (never a mix).
// budgets is optional: the { categoryId, currency, amount } budgets for this
// currency. A category with a budget shows "total / budget", and a bar that
// fills against the budget (amber from 80%, red when exceeded, always with a
// text that says it too).
// Every row has a thin bar with its share of the spending (or its budget).
// limit is optional: it collapses the list to that many rows (rows near or
// over their budget are always kept) with a button to show all of them.
export default function CategoryBars({
  totals,
  currency,
  budgets = [],
  className = 'list',
  limit,
}) {
  const { t } = useSettings()
  const [showAll, setShowAll] = useState(false)
  // shares are measured against the full list, even when rows are hidden
  const all = sum(totals.map((item) => item.total))
  const rows =
    limit === undefined || showAll
      ? totals
      : pickCategoryRows(totals, budgets, limit)
  const hidden = rows.length < totals.length

  return (
    <>
      <ul className={`${className} cat-list`}>
        {rows.map(({ category, total }, index) => {
          const budget = budgets.find((b) => b.categoryId === category.id)
          const ratio = budget ? total / budget.amount : 0
          const barWidth = budget ? Math.min(ratio, 1) * 100 : (total / all) * 100
          let barColor = categoryColor(category)
          if (budget && ratio >= 1) barColor = 'var(--danger)'
          else if (budget && ratio >= 0.8) barColor = 'var(--warning)'
          const share = `${shareText(total, all)} ${t('ofSpending')}`

          return (
            <li key={category.id}>
              <div className="tx-row is-static">
                <CategoryIcon category={category} />
                <span className="tx-text">
                  <span className="tx-name">{categoryLabel(category, t)}</span>
                  <span className="tx-meta">{share}</span>
                </span>
                <span className="tx-amount cat-amount">
                  <span>{formatMoney(total, currency)}</span>
                  {budget && (
                    <span className="cat-budget">
                      / {formatMoney(budget.amount, currency)}
                    </span>
                  )}
                </span>
              </div>
              <div className="mini-bar" aria-hidden="true">
                <div style={{ width: `${barWidth}%`, background: barColor }} />
              </div>
              {budget && ratio >= 1 && (
                <p className="budget-note over">
                  {t('overBudgetBy').replace(
                    '{amount}',
                    formatMoney(sum([total, -budget.amount]), currency),
                  )}
                </p>
              )}
              {budget && ratio >= 0.8 && ratio < 1 && (
                <p className="budget-note near">
                  {budgetPercent(ratio)}% {t('ofBudget')}
                </p>
              )}
              {hidden && index === rows.length - 1 && (
                <button
                  type="button"
                  className="pill show-all"
                  onClick={() => setShowAll(true)}
                >
                  {t('showAll')} ({totals.length})
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
