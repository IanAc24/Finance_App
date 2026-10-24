import { Link, useLocation } from 'react-router-dom'
import { categoryLabel } from '../lib/categories'
import { parseDate, todayString } from '../lib/dates'
import { dateWithYear } from '../lib/describe'
import { formatDate } from '../lib/format'
import { formatMoney } from '../lib/money'
import { THIN } from '../lib/moneyDisplay'
import { paymentLabel } from '../lib/payment'
import { useSettings } from '../context/useSettings'
import CategoryIcon from './CategoryIcon'

// One of the recent movements of Home: a soft row with a square icon, the
// name and the date on the left and, on the right, the amount with the
// payment method under it. The whole row opens the edit screen. A movement
// dated after today says "Upcoming" in words.
export default function RecentRow({ tx, category }) {
  const { locale, t } = useSettings()
  const { pathname } = useLocation()
  const isIncome = tx.type === 'income'
  const fallback = isIncome ? t('typeIncome') : t('category.uncategorized')
  const label = category ? categoryLabel(category, t) : fallback
  const upcoming = tx.date > todayString()
  // a movement dated in a later year says which, so '05/03' is never a guess
  const date = upcoming
    ? dateWithYear(parseDate(tx.date), new Date(), locale)
    : formatDate(parseDate(tx.date), locale, { year: false })
  const meta = [tx.note ? label : '', date].filter(Boolean).join(' · ')

  return (
    <li>
      <Link className="recent-row" to={`/edit/${tx.id}`} state={{ from: pathname }}>
        <CategoryIcon
          category={isIncome ? undefined : category}
          kind={isIncome ? 'income' : undefined}
          size={44}
        />
        <span className="hist-row-text">
          <span className="hist-row-name">{tx.note || label}</span>
          <span className="hist-row-meta">
            {upcoming && <span className="tx-upcoming">{t('upcoming')}</span>}
            {upcoming && ' · '}
            {meta}
          </span>
        </span>
        <span className="recent-side">
          <span className={isIncome ? 'hist-row-amount income' : 'hist-row-amount'}>
            {isIncome ? '+' : '−'}
            {THIN}
            {formatMoney(tx.amount, tx.currency)}
          </span>
          <span className="hist-row-meta">{paymentLabel(tx.paymentMethod, t)}</span>
        </span>
      </Link>
    </li>
  )
}
