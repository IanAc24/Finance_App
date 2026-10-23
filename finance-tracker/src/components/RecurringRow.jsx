import { categoryLabel } from '../lib/categories'
import { formatMoney } from '../lib/money'
import { scheduleKey } from '../lib/recurring'
import { useSettings } from '../context/useSettings'
import { useTransactions } from '../context/useTransactions'
import CategoryIcon, { Icon } from './CategoryIcon'

// One recurring item as a list row: icon, name, category and schedule, and the
// signed amount. With `onClick` the whole row is a button (the settings screen
// opens the editor with it, `expanded` says if it is open) and ends with an
// arrow; without it the row is plain text (Home).
export default function RecurringRow({ item, onClick, expanded }) {
  const { t } = useSettings()
  const { categories, quincenaSchedule } = useTransactions()
  const isIncome = item.type === 'income'
  const category = isIncome
    ? undefined
    : categories.find((c) => c.id === item.categoryId)
  const fallback = isIncome ? t('typeIncome') : t('category.uncategorized')
  const label = category ? categoryLabel(category, t) : fallback

  const content = (
    <>
      <CategoryIcon category={category} kind={isIncome ? 'income' : undefined} />
      <span className="tx-text">
        <span className="tx-name">{item.note || label}</span>
        <span className="tx-meta">
          {label} · {t(scheduleKey(item.schedule, quincenaSchedule))}
        </span>
      </span>
      <span className={isIncome ? 'tx-amount income' : 'tx-amount'}>
        {isIncome ? '+' : '−'}
        {formatMoney(item.amount, item.currency)}
      </span>
      {onClick && (
        <span className={expanded ? 'row-chevron is-open' : 'row-chevron'}>
          <span className="sr-only">{t('edit')}</span>
          <Icon name="chevronRight" size={20} />
        </span>
      )}
    </>
  )

  if (!onClick) return <div className="tx-row">{content}</div>

  return (
    <button
      type="button"
      className="tx-row row-button"
      aria-expanded={expanded}
      onClick={onClick}
    >
      {content}
    </button>
  )
}
