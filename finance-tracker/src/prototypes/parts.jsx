import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../context/useSettings'
import { useTransactions } from '../context/useTransactions'
import { categoryLabel } from '../lib/categories'
import { parseDate } from '../lib/dates'
import { formatDate } from '../lib/format'
import { formatMoney } from '../lib/money'
import { scheduleKey } from '../lib/recurring'
import Logo from '../components/Logo'
import CategoryIcon, { Icon } from './CategoryIcon'
import { copy } from './copy'
import { describeTx } from './txView'

// Pieces both directions use. Each direction styles them its own way through
// the class of the screen that holds them.

// One transaction: icon, description, meta and a right-aligned amount.
// Long notes are cut with an ellipsis inside their box.
export function TxRow({ tx, withDate = false }) {
  const { t, locale } = useSettings()
  const { categories } = useTransactions()
  const { pathname, search } = useLocation()
  const view = describeTx(tx, categories, t)
  const meta = [
    ...view.metaParts,
    withDate && formatDate(parseDate(tx.date), locale, { year: false }),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <Link
        className="proto-row"
        to={`/edit/${tx.id}`}
        state={{ from: pathname + search }}
      >
        <CategoryIcon category={view.category} kind={view.kind} />
        <span className="proto-row-text">
          <span className="proto-row-name">{view.name}</span>
          {meta && <span className="proto-row-meta">{meta}</span>}
        </span>
        <span className={view.isIncome ? 'proto-amt is-income' : 'proto-amt'}>
          {view.amountText}
        </span>
      </Link>
    </li>
  )
}

// The "Confirmar / Omitir" items of the quincena, as a checklist
export function DueList({ model }) {
  const { due, handled, busy, confirmDue, skipDue, t } = model
  const { categories, quincenaSchedule } = useTransactions()

  const describe = (item) => {
    const isIncome = item.type === 'income'
    const category = isIncome
      ? undefined
      : categories.find((c) => c.id === item.categoryId)
    const label = category
      ? categoryLabel(category, t)
      : isIncome
        ? copy.noteFallbackIncome
        : copy.uncategorized
    return {
      category,
      isIncome,
      name: item.note || label,
      meta: `${label} · ${t(scheduleKey(item.schedule, quincenaSchedule))}`,
      amount: `${isIncome ? '+' : '−'}${formatMoney(item.amount, item.currency)}`,
    }
  }

  return (
    <ul className="proto-list proto-due-list">
      {due.map((item) => {
        const v = describe(item)
        return (
          <li className="proto-due" key={item.id}>
            <div className="proto-due-top">
              <CategoryIcon category={v.category} kind={v.isIncome ? 'income' : undefined} />
              <span className="proto-row-text">
                <span className="proto-row-name">{v.name}</span>
                <span className="proto-row-meta">{v.meta}</span>
              </span>
              <span className={v.isIncome ? 'proto-amt is-income' : 'proto-amt'}>
                {v.amount}
              </span>
            </div>
            <div className="proto-actions">
              <button
                type="button"
                className="proto-chip is-primary"
                disabled={busy}
                onClick={() => confirmDue(item)}
              >
                {copy.confirm}
              </button>
              <button
                type="button"
                className="proto-chip"
                disabled={busy}
                onClick={() => skipDue(item)}
              >
                {copy.skip}
              </button>
            </div>
          </li>
        )
      })}
      {handled.map((item) => {
        const v = describe(item)
        return (
          <li className="proto-due is-done" key={item.id}>
            <div className="proto-due-top">
              <CategoryIcon category={v.category} kind={v.isIncome ? 'income' : undefined} />
              <span className="proto-row-text">
                <span className="proto-row-name">{v.name}</span>
                <span className="proto-row-meta">{v.meta}</span>
              </span>
              <span className="proto-done">
                <Icon name="check" size={16} />
                {copy.done}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Last quincena's leftover, offered once per currency
export function LeftoverOffers({ model }) {
  const { offers, busy, moveLeftover, skipLeftover } = model
  if (offers.length === 0) return null
  return (
    <section className="proto-block proto-offer" aria-label={copy.leftoverTitle}>
      <h2 className="proto-h2">{copy.leftoverTitle}</h2>
      <ul className="proto-list">
        {offers.map(({ code, leftover }) => (
          <li key={code}>
            <p className="proto-offer-amount">{formatMoney(leftover, code)}</p>
            <div className="proto-actions">
              <button
                type="button"
                className="proto-chip is-primary"
                disabled={busy}
                onClick={() => moveLeftover(code, leftover)}
              >
                {copy.moveToSavings}
              </button>
              <button
                type="button"
                className="proto-chip"
                disabled={busy}
                onClick={() => skipLeftover(code)}
              >
                {copy.notNow}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Link to savings with the balance of each currency
export function SavingsLink({ model }) {
  const { balancesText, transactions, savings } = model
  if (transactions.length === 0 && savings.length === 0) return null
  return (
    <Link className="proto-savings" to="/savings">
      <CategoryIcon kind="savings" />
      <span className="proto-row-text">
        <span className="proto-row-name">{copy.savingsTitle}</span>
        <span className="proto-row-meta">{balancesText}</span>
      </span>
    </Link>
  )
}

// The live message after an action ("Listo, lo registramos.")
export function Notice({ text }) {
  return (
    <div className="proto-live" role="status" aria-live="polite">
      {text && <p className="proto-notice">{text}</p>}
    </div>
  )
}

// Welcoming empty state with the main action
export function Welcome({ title, text, history = false }) {
  return (
    <section className="proto-welcome">
      <Logo className="proto-welcome-logo" />
      <h2 className="proto-h2">{title}</h2>
      <p className="proto-body">{text}</p>
      <div className="proto-welcome-actions">
        <Link className="proto-btn" to="/add?type=expense">
          {history ? copy.addExpense : copy.emptyFirstExpense}
        </Link>
        <Link className="proto-link" to="/add?type=income">
          {copy.addIncome}
        </Link>
      </div>
    </section>
  )
}
