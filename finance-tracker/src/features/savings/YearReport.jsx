import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../../context/useSettings'
import { formatMoney } from '../../lib/money'
import { availableYears, savingsYear } from '../../lib/savingsReport'
import { yearsWithSavings } from '../../lib/savingsUi'

// The yearly report of the savings of ONE currency: opening balance, what was
// put in, what was taken out and the closing balance. The balance carries
// over from year to year and is never reset. Years that had savings activity
// get a compact row each, so they can be compared (same currency only).
export default function YearReport({ transactions, savings, goals, currency, today }) {
  const { t } = useSettings()
  const thisYear = today.getFullYear()
  const [year, setYear] = useState(thisYear)

  const years = useMemo(() => {
    const list = new Set([thisYear, ...availableYears(transactions, savings, goals)])
    return [...list].sort((a, b) => b - a)
  }, [transactions, savings, goals, thisYear])

  const report = savingsYear(savings, year, currency)
  const rows = yearsWithSavings(savings, years, currency)
  const rowsOfOtherYears = rows.some((row) => row.year !== year)

  const lines = [
    ['svOpening', report.opening],
    ['svDeposited', report.deposits],
    ['svWithdrawn', report.withdrawals],
    ['svClosing', report.closing],
  ]

  return (
    <section className="card sv-year" aria-labelledby="sv-year-title">
      <h2 className="section-title" id="sv-year-title">
        {t('svYearReport')}
      </h2>

      <div className="hist-chip-row" role="group" aria-label={t('year')}>
        {years.map((value) => (
          <button
            key={value}
            type="button"
            className={value === year ? 'chip is-on' : 'chip'}
            aria-pressed={value === year}
            onClick={() => setYear(value)}
          >
            {value}
          </button>
        ))}
      </div>

      <dl className="sv-year-list">
        {lines.map(([key, amount], index) => (
          <div className={index === lines.length - 1 ? 'sv-year-row is-total' : 'sv-year-row'} key={key}>
            <dt>{t(key)}</dt>
            <dd className="nowrap" data-key={key}>
              {formatMoney(amount, currency)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="sub">{t('svCarryOver')}</p>

      {rowsOfOtherYears && (
        <div className="sv-compare">
          <h3 className="label">{t('svOtherYears')}</h3>
          <ul className="sv-compare-list">
            {rows.map((row) => (
              <li className="sv-compare-row" key={row.year}>
                <span className="sv-compare-year">{row.year}</span>
                <span className="sv-compare-moves">
                  <span className="nowrap">+{formatMoney(row.deposits, currency)}</span>
                  <span className="nowrap">−{formatMoney(row.withdrawals, currency)}</span>
                </span>
                <span className="sv-compare-close nowrap">{formatMoney(row.closing, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link className="btn secondary sv-recap-link" to={`/savings/recap/${year}`}>
        {t('svRecapOpen')}
      </Link>
    </section>
  )
}
