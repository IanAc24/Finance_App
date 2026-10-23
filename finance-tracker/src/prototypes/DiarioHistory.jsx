import CategoryIcon from './CategoryIcon'
import { copy } from './copy'
import { MonthNav } from './historyParts'
import { Welcome } from './parts'
import { dayLabel, describeTx, signedNet } from './txView'
import { useHistoryModel } from './useHistoryModel'
import { Link, useLocation } from 'react-router-dom'

const filters = [
  { value: 'all', label: copy.filterAll },
  { value: 'expense', label: copy.filterExpenses },
  { value: 'income', label: copy.filterIncome },
]

// One point of the timeline: the icon sits on the vertical line
function TimelineItem({ tx, categories, t }) {
  const { pathname, search } = useLocation()
  const view = describeTx(tx, categories, t)
  const meta = view.metaParts.join(' · ')
  return (
    <li className="proto-tl-item">
      <Link
        className="proto-tl-link"
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

// Direction 2, "Diario": a timeline, sticky days and a type filter
export default function DiarioHistory() {
  const model = useHistoryModel()
  const { transactions, categories, list, days, today, locale, type, setType, t } = model

  if (transactions.length === 0) {
    return (
      <div className="proto-screen proto-diario">
        <Welcome title={copy.emptyHistoryTitle} text={copy.emptyHistoryText} history />
      </div>
    )
  }

  return (
    <div className="proto-screen proto-diario">
      <MonthNav model={model} />

      <div className="proto-chips" role="group" aria-label={copy.filterLabel}>
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            className={type === f.value ? 'proto-chip is-on' : 'proto-chip'}
            aria-pressed={type === f.value}
            onClick={() => setType(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="proto-body">
          {type === 'all' ? copy.emptyMonthText : copy.emptyFilterText}
        </p>
      ) : (
        <div className="proto-timeline">
          {days.map((day) => (
            <section className="proto-tl-day" key={day.date}>
              <h2 className="proto-tl-head">
                <span>{dayLabel(day.date, today, locale)}</span>
                <span className="proto-tl-total">
                  {day.totals.map((c) => (
                    <span key={c.code}>{signedNet(c.net, c.code)}</span>
                  ))}
                </span>
              </h2>
              <ul className="proto-tl-list">
                {day.items.map((tx) => (
                  <TimelineItem key={tx.id} tx={tx} categories={categories} t={t} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
