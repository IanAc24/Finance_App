import { formatMoney } from '../lib/money'
import { copy, countWord, currencyName } from './copy'
import { MonthNav } from './historyParts'
import { TxRow, Welcome } from './parts'
import { dayLabel, signedNet } from './txView'
import { useHistoryModel } from './useHistoryModel'

// Direction 1, "Resumen": the month in two lines, then days with hairlines
export default function ResumenHistory() {
  const model = useHistoryModel()
  const { transactions, list, days, summaries, today, locale } = model

  if (transactions.length === 0) {
    return (
      <div className="proto-screen proto-resumen">
        <Welcome title={copy.emptyHistoryTitle} text={copy.emptyHistoryText} history />
      </div>
    )
  }

  return (
    <div className="proto-screen proto-resumen">
      <MonthNav model={model} />

      {list.length === 0 ? (
        <p className="proto-body">{copy.emptyMonthText}</p>
      ) : (
        <>
          <section className="proto-month-totals" aria-label={countWord(list.length)}>
            {summaries.map((s) => (
              <p className="proto-month-line" key={s.code}>
                <span className="proto-month-cur">{currencyName(s.code)}</span>
                <span className="proto-amt is-income">+{formatMoney(s.income, s.code)}</span>
                <span className="proto-amt">
                  {s.spent > 0 ? '−' : ''}
                  {formatMoney(s.spent, s.code)}
                </span>
              </p>
            ))}
            <p className="proto-row-meta">
              {copy.incomeLabel} · {copy.spentLabel} · {countWord(list.length)}
            </p>
          </section>

          {days.map((day) => (
            <section className="proto-day-group" key={day.date}>
              <header className="proto-day-head">
                <h2 className="proto-day-title">{dayLabel(day.date, today, locale)}</h2>
                <span className="proto-day-total">
                  {day.totals.map((c) => (
                    <span key={c.code}>{signedNet(c.net, c.code)}</span>
                  ))}
                </span>
              </header>
              <ul className="proto-list is-lines">
                {day.items.map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
