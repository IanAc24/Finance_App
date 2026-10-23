import { Link } from 'react-router-dom'
import { categoryLabel } from '../lib/categories'
import { formatMoney } from '../lib/money'
import CategoryIcon, { Icon } from './CategoryIcon'
import {
  budgetLeft,
  budgetOf,
  copy,
  currencyName,
  dayProgress,
  overBudget,
} from './copy'
import { DueList, LeftoverOffers, Notice, SavingsLink, TxRow, Welcome } from './parts'
import { summaryOf } from './txView'
import { useHomeModel } from './useHomeModel'

const tiles = [
  { to: '/add?type=expense', icon: 'wallet', label: copy.expenseWord },
  { to: '/add?type=income', icon: 'arrowDownLeft', label: copy.incomeWord },
  { to: '/savings', icon: 'piggyBank', label: copy.savingsWord },
]

// One budget: how much is used, a soft bar, and the state also in words
function BudgetRow({ budget, spent, category, currency, t }) {
  const ratio = budget.amount > 0 ? spent / budget.amount : 0
  const state = ratio >= 1 ? 'is-over' : ratio >= 0.8 ? 'is-near' : ''
  const words =
    ratio > 1
      ? overBudget(formatMoney(spent - budget.amount, currency))
      : budgetLeft(formatMoney(budget.amount - spent, currency))
  return (
    <li className={`proto-budget ${state}`}>
      <div className="proto-budget-top">
        <CategoryIcon category={category} />
        <span className="proto-row-text">
          <span className="proto-row-name">{categoryLabel(category, t)}</span>
          <span className="proto-row-meta">
            {budgetOf(formatMoney(spent, currency), formatMoney(budget.amount, currency))}
          </span>
        </span>
      </div>
      <div className="proto-meter" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.min(ratio, 1)})` }} />
      </div>
      <p className="proto-budget-words">{words}</p>
    </li>
  )
}

// Direction 2, "Diario": starts from today, talks, and puts the actions first
export default function DiarioHome() {
  const model = useHomeModel()
  const {
    shown,
    due,
    handled,
    transactions,
    todayList,
    yesterdayList,
    categories,
    profile,
    dayNumber,
    totalDays,
    t,
    notice,
  } = model
  const main = shown[0]
  const others = shown.slice(1)
  const hasDue = due.length > 0 || handled.length > 0

  if (transactions.length === 0 && !hasDue) {
    return (
      <div className="proto-screen proto-diario">
        <Welcome title={copy.emptyTitle} text={copy.emptyText} />
      </div>
    )
  }

  const summary = main && summaryOf(main, model)
  const budgetRows = main
    ? main.budgets
        .map((budget) => {
          const category = categories.find((c) => c.id === budget.categoryId)
          const spent =
            main.categoryTotals.find((item) => item.category.id === budget.categoryId)
              ?.total ?? 0
          return { budget, category, spent }
        })
        .filter((row) => row.category)
    : []

  return (
    <div className="proto-screen proto-diario">
      <Notice text={notice} />

      {main ? (
        <section className="proto-talk" aria-label={copy.talkToday}>
          {profile.name && (
            <p className="proto-hello">
              {copy.hello}, {profile.name}
            </p>
          )}
          <p className="proto-eyebrow">
            {summary.hasBase ? copy.talkToday : copy.talkLeftOnly}
            {others.length > 0 && ` · ${currencyName(main.code)}`}
          </p>
          <p className="proto-big">{summary.amount}</p>
          {summary.message ? (
            <p className="proto-body" role="status">
              {summary.message}
            </p>
          ) : (
            summary.hasBase && (
              <p className="proto-body">{summary.sentence}</p>
            )
          )}
          <div className="proto-day">
            <span className="proto-day-text">{dayProgress(dayNumber, totalDays)}</span>
            <div
              className="proto-meter"
              role="progressbar"
              aria-label={dayProgress(dayNumber, totalDays)}
              aria-valuemin={0}
              aria-valuemax={totalDays}
              aria-valuenow={dayNumber}
            >
              <span style={{ transform: `scaleX(${dayNumber / totalDays})` }} />
            </div>
          </div>
        </section>
      ) : (
        <Welcome title={copy.emptyQuincenaTitle} text={copy.emptyQuincenaText} />
      )}

      <nav className="proto-tiles" aria-label={copy.quickActions}>
        {tiles.map((tile) => (
          <Link className="proto-tile" to={tile.to} key={tile.to}>
            <Icon name={tile.icon} size={24} />
            <span>{tile.label}</span>
          </Link>
        ))}
      </nav>

      <LeftoverOffers model={model} />

      <section className="proto-block" aria-labelledby="proto-today">
        <h2 className="proto-h2" id="proto-today">
          {copy.today}
        </h2>
        {todayList.length > 0 ? (
          <ul className="proto-list is-lines">
            {todayList.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </ul>
        ) : (
          <p className="proto-body">{copy.nothingToday}</p>
        )}
      </section>

      <section className="proto-block" aria-labelledby="proto-yesterday">
        <h2 className="proto-h2" id="proto-yesterday">
          {copy.yesterday}
        </h2>
        {yesterdayList.length > 0 ? (
          <ul className="proto-list is-lines">
            {yesterdayList.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </ul>
        ) : (
          <p className="proto-body">{copy.nothingYesterday}</p>
        )}
        <Link className="proto-link" to="/history">
          {copy.seeAll}
        </Link>
      </section>

      {main && (
        <section className="proto-block" aria-labelledby="proto-budgets">
          <h2 className="proto-h2" id="proto-budgets">
            {copy.budgetsTitle}
          </h2>
          {budgetRows.length > 0 ? (
            <ul className="proto-list">
              {budgetRows.map(({ budget, category, spent }) => (
                <BudgetRow
                  key={budget.categoryId}
                  budget={budget}
                  category={category}
                  spent={spent}
                  currency={main.code}
                  t={t}
                />
              ))}
            </ul>
          ) : (
            <>
              <p className="proto-body">{copy.budgetsInvite}</p>
              <Link className="proto-link" to="/settings/budgets">
                {copy.budgetsLink}
              </Link>
            </>
          )}
        </section>
      )}

      {hasDue && (
        <section className="proto-block" aria-labelledby="proto-due">
          <h2 className="proto-h2" id="proto-due">
            {copy.dueTitle}
          </h2>
          <DueList model={model} />
        </section>
      )}

      <SavingsLink model={model} />

      {others.map((c) => {
        const s = summaryOf(c, model)
        return (
          <section className="proto-secondary" key={c.code}>
            <p className="proto-eyebrow">
              {copy.otherCurrency} · {currencyName(c.code)}
            </p>
            <p className="proto-mid">
              {s.hasBase ? `${copy.canSpendToday} ${s.amount}` : `${copy.leftOnlyLabel} ${s.amount}`}
            </p>
            <p className="proto-body">{s.message ?? s.sentence}</p>
          </section>
        )
      })}
    </div>
  )
}
