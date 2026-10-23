import { Link, useLocation } from 'react-router-dom'
import { categoryLabel } from '../lib/categories'
import { parseDate, todayString } from '../lib/dates'
import { formatDate } from '../lib/format'
import { formatMoney } from '../lib/money'
import { paymentNote } from '../lib/payment'
import { useSettings } from '../context/useSettings'
import { useTransactions } from '../context/useTransactions'
import CategoryIcon from './CategoryIcon'

// One transaction as a list row: icon, description, meta and the amount on the
// right. The whole row is the tap target. A movement dated after today says
// "Upcoming" in its meta line (in words, not only a colour). Long text is cut with an ellipsis on
// one line. Expenses are "−" in the text colour, income "+" in the income colour.
export default function TransactionItem({ tx, showDate = true }) {
  const { locale, t } = useSettings()
  const { categories } = useTransactions()
  const { pathname } = useLocation()
  const isIncome = tx.type === 'income'
  const category = categories.find((c) => c.id === tx.categoryId)
  const fallback = isIncome ? t('typeIncome') : t('category.uncategorized')
  const label = category ? categoryLabel(category, t) : fallback
  const date = formatDate(parseDate(tx.date), locale, { year: false })
  // card and SINPE are named in the row; cash is the default and says nothing
  const method = paymentNote(tx.paymentMethod, t)
  const join = (...parts) => parts.filter(Boolean).join(' · ')
  // with a note the category goes in the meta; without one it is the name
  const meta = tx.note
    ? showDate
      ? join(label, date, method)
      : join(label, method)
    : join(showDate && date, method)

  const upcoming = tx.date > todayString()

  return (
    <li>
      {/* "from" tells the edit screen where to go back to */}
      <Link
        className="tx-row row-link"
        to={`/edit/${tx.id}`}
        state={{ from: pathname }}
      >
        <CategoryIcon
          category={isIncome ? undefined : category}
          kind={isIncome ? 'income' : undefined}
        />
        <span className="tx-text">
          <span className="tx-name">{tx.note || label}</span>
          {(meta || upcoming) && (
            <span className="tx-meta">
              {upcoming && <span className="tx-upcoming">{t('upcoming')}</span>}
              {upcoming && meta && ' · '}
              {meta}
            </span>
          )}
        </span>
        <span className={isIncome ? 'tx-amount income' : 'tx-amount'}>
          {isIncome ? '+' : '−'}
          {formatMoney(tx.amount, tx.currency)}
        </span>
      </Link>
    </li>
  )
}
