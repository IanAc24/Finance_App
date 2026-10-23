import { Link } from 'react-router-dom'
import { categoryColor, categoryLabel } from '../lib/categories'
import { formatMoney, sum } from '../lib/money'
import CategoryIcon from './CategoryIcon'
import { copy, currencyName } from './copy'
import { DueList, LeftoverOffers, Notice, SavingsLink, TxRow, Welcome } from './parts'
import { summaryOf } from './txView'
import { useHomeModel } from './useHomeModel'

const TOP = 4

// Direction 1, "Resumen": one calm summary first, the rest in plain lists
export default function ResumenHome() {
  const model = useHomeModel()
  const { shown, recent, due, handled, transactions, profile, t, notice } = model
  const main = shown[0]
  const others = shown.slice(1)
  const hasDue = due.length > 0 || handled.length > 0

  if (transactions.length === 0 && !hasDue) {
    return (
      <div className="proto-screen proto-resumen">
        <Welcome title={copy.emptyTitle} text={copy.emptyText} />
      </div>
    )
  }

  const summary = main && summaryOf(main, model)
  const totals = main ? main.categoryTotals : []
  const all = sum(totals.map((item) => item.total))
  const top = totals.slice(0, TOP)
  const rest = totals.slice(TOP)
  const restTotal = sum(rest.map((item) => item.total))
  const percent = (value) => (all > 0 ? Math.round((value / all) * 100) : 0)

  return (
    <div className="proto-screen proto-resumen">
      {profile.name && (
        <p className="proto-hello">
          {copy.hello}, {profile.name}
        </p>
      )}

      <Notice text={notice} />

      {main ? (
        <section className="proto-summary" aria-label={copy.canSpendToday}>
          <p className="proto-eyebrow">
            {summary.hasBase ? copy.canSpendToday : copy.leftOnlyLabel}
            {others.length > 0 && ` · ${currencyName(main.code)}`}
          </p>
          <p className="proto-big">{summary.amount}</p>
          {summary.message ? (
            <p className="proto-body" role="status">
              {summary.message}
            </p>
          ) : (
            summary.hasBase && <p className="proto-body">{summary.sentence}</p>
          )}
          <div className="proto-cta">
            <Link className="proto-btn" to="/add?type=expense">
              {copy.addExpense}
            </Link>
            <Link className="proto-link" to="/add?type=income">
              {copy.addIncome}
            </Link>
          </div>
        </section>
      ) : (
        <Welcome title={copy.emptyQuincenaTitle} text={copy.emptyQuincenaText} />
      )}

      {main && (
        <section className="proto-block" aria-labelledby="proto-where">
          <h2 className="proto-h2" id="proto-where">
            {copy.whereMoneyWent}
          </h2>
          {totals.length === 0 ? (
            <p className="proto-body">{copy.nothingSpentYet}</p>
          ) : (
            <>
              <div className="proto-stack" aria-hidden="true">
                {totals.map(({ category, total }) => (
                  <span
                    key={category.id}
                    style={{ flexGrow: total, background: categoryColor(category) }}
                  />
                ))}
              </div>
              <ul className="proto-list">
                {top.map(({ category, total }) => (
                  <li className="proto-cat" key={category.id}>
                    <CategoryIcon category={category.id === 0 ? undefined : category} />
                    <span className="proto-row-text">
                      <span className="proto-row-name">{categoryLabel(category, t)}</span>
                      <span className="proto-row-meta">{percent(total)}%</span>
                    </span>
                    <span className="proto-amt">{formatMoney(total, main.code)}</span>
                  </li>
                ))}
                {rest.length > 0 && (
                  <li className="proto-cat is-rest">
                    <span className="proto-row-text">
                      <span className="proto-row-name">{copy.otherCategories}</span>
                      <span className="proto-row-meta">{percent(restTotal)}%</span>
                    </span>
                    <span className="proto-amt">{formatMoney(restTotal, main.code)}</span>
                  </li>
                )}
              </ul>
            </>
          )}
        </section>
      )}

      <LeftoverOffers model={model} />

      {recent.length > 0 && (
        <section className="proto-block" aria-labelledby="proto-recent">
          <h2 className="proto-h2" id="proto-recent">
            {copy.recent}
          </h2>
          <ul className="proto-list is-lines">
            {recent.map((tx) => (
              <TxRow key={tx.id} tx={tx} withDate />
            ))}
          </ul>
          <Link className="proto-link" to="/history">
            {copy.seeAll}
          </Link>
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
            <p className="proto-body">
              {s.message ?? s.sentence}
            </p>
          </section>
        )
      })}
    </div>
  )
}
