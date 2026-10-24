import { Link, useLocation } from 'react-router-dom'
import { categoryLabel } from '../lib/categories'
import { todayString } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { THIN } from '../lib/moneyDisplay'
import { paymentNote } from '../lib/payment'
import { useSettings } from '../context/useSettings'
import { sourceLabelKey } from '../lib/income'
import CategoryIcon from './CategoryIcon'
import TransitionRow from './TransitionRow'

// One movement of the History list: a 40px icon, the name and the grey meta
// on the left, the amount on the right. The whole row opens the edit screen
// (the state tells it where to go back to). A movement dated after today says
// "Upcoming" in words. `motion` (enter, edit, leave) animates the row, see
// TransitionRow. Expenses are "−" in the text colour, income "+" green.
export default function HistoryRow({ tx, category, motion = null }) {
  const { t } = useSettings()
  const { pathname } = useLocation()
  const isIncome = tx.type === 'income'
  // an income with a source is named by it ("Freelance"), else just "Income"
  const sourceKnown = isIncome && tx.source
  const fallback = isIncome
    ? t(sourceKnown ? sourceLabelKey(tx.source) : 'typeIncome')
    : t('category.uncategorized')
  const label = category ? categoryLabel(category, t) : fallback
  const upcoming = tx.date > todayString()
  // card and SINPE are named in the row; cash is the default and says nothing
  const method = paymentNote(tx.paymentMethod, t)
  const meta = [tx.note ? label : '', method].filter(Boolean)

  return (
    <TransitionRow state={motion}>
      <Link className="hist-row" to={`/edit/${tx.id}`} state={{ from: pathname }}>
        <CategoryIcon
          category={isIncome ? undefined : category}
          kind={isIncome ? 'income' : undefined}
          source={isIncome ? tx.source : undefined}
          size={40}
        />
        <span className="hist-row-text">
          <span className="hist-row-name">{tx.note || label}</span>
          {(meta.length > 0 || upcoming) && (
            <span className="hist-row-meta">
              {upcoming && <span className="tx-upcoming">{t('upcoming')}</span>}
              {upcoming && meta.length > 0 && ' · '}
              {meta.join(' · ')}
            </span>
          )}
        </span>
        <span className={isIncome ? 'hist-row-amount income' : 'hist-row-amount'}>
          {isIncome ? '+' : '−'}
          {THIN}
          {formatMoney(tx.amount, tx.currency)}
        </span>
      </Link>
    </TransitionRow>
  )
}
