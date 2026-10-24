import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/CategoryIcon'
import Figure from '../../components/Figure'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import { formatDate, formatMonth } from '../../lib/format'
import { currencies, formatMoney } from '../../lib/money'
import { buildReport } from '../../lib/report'
import { parseDate } from '../../lib/dates'
import { useToday } from '../../lib/useToday'

// How long the screen waits before opening the print dialog by itself, so the
// report is painted first
const PRINT_DELAY_MS = 300

// The scope comes from the router state; anything unexpected (a typed
// address has no state) falls back to everything
function readScope(state) {
  const scope = state?.scope
  if (scope?.kind === 'month' && Number.isInteger(scope.year) && Number.isInteger(scope.month)) {
    return { kind: 'month', year: scope.year, month: scope.month }
  }
  if (scope?.kind === 'list' && Array.isArray(scope.ids)) {
    return { kind: 'list', ids: scope.ids }
  }
  return { kind: 'all' }
}

const currencyName = (code) => currencies.find((c) => c.code === code).labelKey

// The printable report: an ordinary page on screen, and the only thing that
// shows in print (see @media print in index.css). It opens the print dialog
// once by itself; "Save as PDF" is a choice of the browser's dialog.
export default function ReportScreen() {
  const { t, locale } = useSettings()
  const { transactions, categories, savings } = useTransactions()
  const { state, key } = useLocation()
  const navigate = useNavigate()
  const today = useToday()
  const printed = useRef(false)

  const scope = readScope(state)
  const { sections } = buildReport({ transactions, savings, categories, scope, t })
  const hasData = sections.length > 0

  // Once, after the first render with data. The guard is set when the dialog
  // opens (not when the timer starts), so React's double effect in development
  // cancels the first timer and still prints a single time.
  useEffect(() => {
    if (!hasData || printed.current) return undefined
    const id = setTimeout(() => {
      printed.current = true
      window.print()
    }, PRINT_DELAY_MS)
    return () => clearTimeout(id)
  }, [hasData])

  const goBack = () => (key === 'default' ? navigate('/') : navigate(-1))

  let period = t('allMonths')
  if (scope.kind === 'month') period = formatMonth(new Date(scope.year, scope.month, 1), locale)
  if (scope.kind === 'list') period = t('reportFiltered')

  return (
    <div className="narrow report">
      <div className="report-bar">
        <button type="button" className="back-link" onClick={goBack}>
          <Icon name="chevronLeft" size={20} />
          <span>{t('reportBack')}</span>
        </button>
        {hasData && (
          <button type="button" className="btn" onClick={() => window.print()}>
            {t('savePdf')}
          </button>
        )}
      </div>

      <header className="report-head">
        <h1 className="report-title">
          {`${t('titleMain')} ${t('titleAccent')} — ${t('report')}`}
        </h1>
        <p className="report-period">{period}</p>
        <p className="report-generated">
          {t('reportGenerated').replace('{date}', formatDate(today, locale))}
        </p>
      </header>

      {!hasData && <p className="report-empty">{t('reportEmpty')}</p>}

      {sections.map((section) => (
        <section className="report-section" key={section.key}>
          {scope.kind === 'all' && (
            <h2 className="report-month">
              {formatMonth(new Date(section.year, section.month, 1), locale)}
            </h2>
          )}

          <h3 className="report-sub">{t('reportSummary')}</h3>
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">{t('reportCurrency')}</th>
                <th scope="col" className="num">{t('income')}</th>
                <th scope="col" className="num">{t('spent')}</th>
                <th scope="col" className="num">{t('toSavings')}</th>
                <th scope="col" className="num">{t('fromSavings')}</th>
              </tr>
            </thead>
            <tbody>
              {section.totals.map((row) => (
                <tr key={row.code}>
                  <th scope="row">{t(currencyName(row.code))}</th>
                  <td className="num">
                    <Figure amount={row.income} code={row.code} kind="income" />
                  </td>
                  <td className="num">
                    <Figure amount={row.spent} code={row.code} kind="spent" />
                  </td>
                  <td className="num nowrap">{formatMoney(row.savedIn, row.code)}</td>
                  <td className="num nowrap">{formatMoney(row.savedOut, row.code)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {section.categories.length > 0 && (
            <>
              <h3 className="report-sub">{t('reportByCategory')}</h3>
              {section.categories.map((group) => (
                <table className="report-table" key={group.code}>
                  <caption>{t(currencyName(group.code))}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('category')}</th>
                      <th scope="col" className="num">{t('spent')}</th>
                      <th scope="col" className="num">{t('reportShare')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.category.id}>
                        <th scope="row">{row.label}</th>
                        <td className="num">
                          <Figure amount={row.amount} code={group.code} kind="spent" />
                        </td>
                        <td className="num nowrap">
                          {`${row.share.toLocaleString(locale, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })} %`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </>
          )}

          {section.days.length > 0 && <h3 className="report-sub">{t('movements')}</h3>}
          {section.days.map((day) => (
            <div className="report-day" key={day.date}>
              <h4 className="report-day-title">
                {formatDate(parseDate(day.date), locale, { weekday: true })}
              </h4>
              <table className="report-table report-moves">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{t('reportDescription')}</th>
                    <th scope="col">{t('category')}</th>
                    <th scope="col">{t('paymentMethod')}</th>
                    <th scope="col" className="num">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {day.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{item.categoryLabel}</td>
                      <td>{item.paymentLabel}</td>
                      <td className="num">
                        <Figure
                          amount={Math.abs(item.amount)}
                          code={item.currency}
                          kind={item.type}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
