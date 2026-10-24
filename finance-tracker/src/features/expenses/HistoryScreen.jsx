import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../../context/useTransactions'
import { categoryLabel } from '../../lib/categories'
import { downloadCsv, transactionRows } from '../../lib/csv'
import { byNewest, getQuincenaRange, isSameMonth, parseDate } from '../../lib/dates'
import { dayTitle } from '../../lib/days'
import { formatDate, formatMonth, monthName } from '../../lib/format'
import { currencies, getTotals } from '../../lib/money'
import { paymentMethods, totalsByMethod } from '../../lib/payment'
import { filterTransactions, hasFilters } from '../../lib/search'
import { useToday } from '../../lib/useToday'
import { useSettings } from '../../context/useSettings'
import { Icon } from '../../components/CategoryIcon'
import EmptyState from '../../components/EmptyState'
import Figure from '../../components/Figure'
import HistoryRow from '../../components/HistoryRow'
import Sheet from '../../components/Sheet'

// The query as shown in the "nothing found" title: short, on one line
const QUERY_SHOWN = 30

// A clean list: no cards, bold day headings with the day's spending on the
// right, big icons and amounts on the right. The type is a row of chips, the
// month and the other filters (category, payment method) open in a sheet and
// the search opens from the magnifier.
export default function HistoryScreen() {
  const { lang, locale, t } = useSettings()
  const navigate = useNavigate()
  const { transactions, categories, quincenaSchedule } = useTransactions()

  const today = useToday()
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [method, setMethod] = useState('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sheet, setSheet] = useState(null) // 'month' | 'filters' | null
  const [methodsOpen, setMethodsOpen] = useState(false)
  const searchInput = useRef(null)
  const filters = { query, type, categoryId, method }
  const filtering = hasFilters(filters)
  const searchShown = searchOpen || query !== ''
  // category and payment method are the filters that live in the sheet
  const sheetFilters = [categoryId, method].filter((v) => v !== 'all').length

  // the field gets the focus when the search opens
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus()
  }, [searchOpen])

  // later months can be seen too when a transaction is dated in one
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const canGoNext =
    nextMonth <= today ||
    transactions.some((tx) => parseDate(tx.date) >= nextMonth)

  const changeMonth = (step) => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + step, 1))
  }

  const clearFilters = () => {
    setQuery('')
    setType('all')
    setCategoryId('all')
    setMethod('all')
    setSearchOpen(false)
  }

  // Filtering searches every month; otherwise it is the month on screen
  const list = (
    filtering
      ? filterTransactions(transactions, filters, categories, t)
      : transactions.filter((tx) => isSameMonth(parseDate(tx.date), month))
  ).sort(byNewest)

  // one group per day, newest first, with the day's spending and income per
  // currency (never netted, never a total across currencies)
  const days = []
  for (const tx of list) {
    const last = days[days.length - 1]
    if (last && last.date === tx.date) last.items.push(tx)
    else days.push({ date: tx.date, items: [tx] })
  }
  const daysWithTotals = days.map((day) => ({
    ...day,
    totals: currencies
      .map((c) => ({ ...c, ...getTotals(day.items, c.code) }))
      .filter((c) => c.count > 0),
  }))

  // spending per payment method in the quincena of today. It ignores the
  // filters so the three methods can always be compared, and it only shows
  // while the month on screen is the one of today (it would mislead in others)
  const quincena = getQuincenaRange(today, quincenaSchedule)
  // only the methods that were used: a method at ₡0 / $0.00 says nothing, and
  // with a single method used the comparison has nothing to compare
  const methodTotals = totalsByMethod(transactions, quincena).filter((m) =>
    currencies.some((c) => m[c.code].spent > 0),
  )
  const showMethods = !filtering && isSameMonth(month, today) && methodTotals.length > 1

  const summaries = currencies
    .map((c) => ({ ...c, ...getTotals(list, c.code) }))
    .filter((c) => c.count > 0)

  // Same rows and order as the list on screen
  const handleExport = () => {
    const monthNumber = String(month.getMonth() + 1).padStart(2, '0')
    downloadCsv(
      filtering
        ? 'i-am-poor-for-now-search.csv'
        : `i-am-poor-for-now-${month.getFullYear()}-${monthNumber}.csv`,
      transactionRows(list, categories, t, lang),
      lang,
    )
  }

  // The same rows as the CSV, as a printable report: the ids of the results
  // when filtering, the month on screen otherwise
  const handleExportPdf = () => {
    const scope = filtering
      ? { kind: 'list', ids: list.map((tx) => tx.id) }
      : { kind: 'month', year: month.getFullYear(), month: month.getMonth() }
    navigate('/report', { state: { scope } })
  }

  if (transactions.length === 0) {
    return (
      <div className="narrow hist">
        <h1 className="hist-title">{t('history')}</h1>
        <EmptyState />
      </div>
    )
  }

  const shownQuery =
    query.trim().length > QUERY_SHOWN
      ? `${query.trim().slice(0, QUERY_SHOWN)}…`
      : query.trim()

  return (
    <>
      <div className="narrow hist">
        <div className="hist-headrow">
          <h1 className="hist-title">{t('history')}</h1>
          {showMethods && (
            <button
              type="button"
              className="calc-toggle"
              aria-expanded={methodsOpen}
              aria-controls="hist-methods"
              onClick={() => setMethodsOpen((open) => !open)}
            >
              {t('spentByMethod')}
            </button>
          )}
        </div>

        <div className="hist-chips">
          <div className="hist-chip-row" role="group" aria-label={t('type')}>
            {[
              ['all', t('filterAll')],
              ['expense', t('filterExpenses')],
              ['income', t('filterIncome')],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={type === value ? 'chip is-on' : 'chip'}
                aria-pressed={type === value}
                onClick={() => setType(value)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="chip"
              aria-haspopup="dialog"
              disabled={filtering}
              onClick={() => setSheet('month')}
            >
              <span>{filtering ? t('allMonths') : formatMonth(month, locale)}</span>
              <Icon name="chevronDown" size={16} />
            </button>
            <button
              type="button"
              className={sheetFilters > 0 ? 'chip is-on' : 'chip'}
              aria-haspopup="dialog"
              onClick={() => setSheet('filters')}
            >
              <Icon name="sliders" size={16} />
              <span>
                {t('filters')}
                {sheetFilters > 0 ? ` (${sheetFilters})` : ''}
              </span>
            </button>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={searchShown ? t('searchClose') : t('searchOpen')}
            aria-expanded={searchShown}
            onClick={() => {
              if (searchShown) {
                setQuery('')
                setSearchOpen(false)
              } else {
                setSearchOpen(true)
              }
            }}
          >
            <Icon name={searchShown ? 'x' : 'search'} size={20} />
          </button>
        </div>

        {searchShown && (
          <div className="hist-search">
            <Icon name="search" size={18} />
            <input
              ref={searchInput}
              type="search"
              aria-label={t('search')}
              placeholder={t('searchHint')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {/* the month (or the results) per currency: income and spending, never
            added across currencies */}
        {summaries.length > 0 && (
          <div className="hist-sum">
            {summaries.map((s) => (
              <p key={s.code}>
                <span>
                  {filtering ? t('allMonths') : monthName(month, locale)} · {t(s.labelKey)}
                </span>
                {s.income > 0 && <Figure amount={s.income} code={s.code} kind="income" />}
                <Figure amount={s.spent} code={s.code} kind="spent" />
              </p>
            ))}
          </div>
        )}

        {showMethods && methodsOpen && (
          <section className="card" id="hist-methods">
            <h2 className="section-title">{t('spentByMethod')}</h2>
            <p className="sub">
              {t('thisQuincena')} · {formatDate(quincena.start, locale, { year: false })} –{' '}
              {formatDate(quincena.end, locale, { year: false })}
            </p>
            <ul className="list method-list">
              {methodTotals.map((m) => (
                <li className="row" key={m.code}>
                  <span>{t(m.labelKey)}</span>
                  <span className="day-total">
                    {currencies
                      .filter((c) => m[c.code].spent > 0)
                      .map((c) => (
                        <Figure
                          amount={m[c.code].spent}
                          code={c.code}
                          kind="spent"
                          key={c.code}
                        />
                      ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {list.length === 0 && filtering && (
          <EmptyState
            card
            actions={false}
            icon="search"
            title={
              shownQuery
                ? t('noResultsQuery').replace('{query}', shownQuery)
                : t('noResultsFilters')
            }
            text={t('noResultsText')}
          >
            <button type="button" className="btn secondary" onClick={clearFilters}>
              {t('clearFilters')}
            </button>
          </EmptyState>
        )}

        {list.length === 0 && !filtering && (
          <EmptyState
            card
            actions={false}
            icon="calendar"
            title={t('emptyMonthTitle').replace('{month}', monthName(month, locale))}
            text={t('emptyMonthText')}
          />
        )}

        {daysWithTotals.map((day) => (
          <section className="day-group" key={day.date} aria-labelledby={`day-${day.date}`}>
            <header className="day-head">
              <h2 className="day-title" id={`day-${day.date}`}>
                {dayTitle(day.date, today, locale, t, {
                  // results can span years
                  year: filtering,
                })}
              </h2>
              {/* per currency: the spending of the day (text colour, "−") and,
                  only when the day has income, the income (green, "+"). Never
                  netted and never added across currencies */}
              <span className="day-total">
                {day.totals.map((c) => (
                  <span className="day-total-cur" key={c.code}>
                    {/* a day with only income shows just the income */}
                    {(c.spent > 0 || c.income === 0) && (
                      <Figure amount={c.spent} code={c.code} kind="spent" />
                    )}
                    {c.income > 0 && <Figure amount={c.income} code={c.code} kind="income" />}
                  </span>
                ))}
              </span>
            </header>
            <ul className="hist-rows">
              {day.items.map((tx) => (
                <HistoryRow
                  key={tx.id}
                  tx={tx}
                  category={categories.find((cat) => cat.id === tx.categoryId)}
                />
              ))}
            </ul>
          </section>
        ))}

        {list.length > 0 && (
          <div className="hist-export">
            <span className="hist-export-label">
              {filtering ? t('exportResults') : t('exportMonth')}
            </span>
            <button type="button" className="btn secondary" onClick={handleExport}>
              {t('formatCsv')}
            </button>
            <button type="button" className="btn secondary" onClick={handleExportPdf}>
              {t('formatPdf')}
            </button>
          </div>
        )}
      </div>

      <Sheet open={sheet === 'month'} onClose={() => setSheet(null)} title={t('chooseMonth')}>
        <div className="sheet-month">
          <button
            type="button"
            className="icon-btn"
            aria-label={t('prevMonth')}
            onClick={() => changeMonth(-1)}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <p className="sheet-month-name" role="status" aria-live="polite">
            {formatMonth(month, locale)}
          </p>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('nextMonth')}
            disabled={!canGoNext}
            onClick={() => changeMonth(1)}
          >
            <Icon name="chevronRight" size={22} />
          </button>
        </div>
        <button type="button" className="btn" onClick={() => setSheet(null)}>
          {t('done')}
        </button>
      </Sheet>

      <Sheet open={sheet === 'filters'} onClose={() => setSheet(null)} title={t('filters')}>
        <h3 className="sheet-sub" id="filter-method-label">
          {t('paymentMethod')}
        </h3>
        <div className="pill-group wrap" role="group" aria-labelledby="filter-method-label">
          {[['all', t('all')], ...paymentMethods.map((m) => [m.code, t(m.labelKey)])].map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                className={method === value ? 'pill active' : 'pill'}
                aria-pressed={method === value}
                onClick={() => setMethod(value)}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <label className="field">
          <span className="label">{t('category')}</span>
          <select
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
          >
            <option value="all">{t('allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c, t)}
              </option>
            ))}
          </select>
        </label>
        <div className="sheet-actions">
          {filtering && (
            <button type="button" className="btn secondary" onClick={clearFilters}>
              {t('clearFilters')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setSheet(null)}>
            {t('done')}
          </button>
        </div>
      </Sheet>
    </>
  )
}
