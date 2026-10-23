import { categoryLabel } from '../lib/categories'
import { formatMoney } from '../lib/money'
import { scheduleKey } from '../lib/recurring'
import { useSettings } from '../context/useSettings'
import { useTransactions } from '../context/useTransactions'
import CategoryIcon from './CategoryIcon'

// One recurring item as a list row: icon, name, category and schedule, and the
// signed amount. The children go after the amount (the Edit pill on the
// settings screen).
export default function RecurringRow({ item, children }) {
  const { t } = useSettings()
  const { categories, quincenaSchedule } = useTransactions()
  const isIncome = item.type === 'income'
  const category = isIncome
    ? undefined
    : categories.find((c) => c.id === item.categoryId)
  const fallback = isIncome ? t('typeIncome') : t('category.uncategorized')
  const label = category ? categoryLabel(category, t) : fallback

  return (
    <div className="tx-row">
      <CategoryIcon category={category} kind={isIncome ? 'income' : undefined} />
      <span className="tx-text">
        <span className="tx-name">{item.note || label}</span>
        <span className="tx-meta">
          {label} · {t(scheduleKey(item.schedule, quincenaSchedule))}
        </span>
      </span>
      <span className="row-side">
        <span className={isIncome ? 'tx-amount income' : 'tx-amount'}>
          {isIncome ? '+' : '−'}
          {formatMoney(item.amount, item.currency)}
        </span>
        {children}
      </span>
    </div>
  )
}
