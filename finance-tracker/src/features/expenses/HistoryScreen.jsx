import { useState } from 'react'
import { useTransactions } from '../../context/useTransactions'
import { categoryLabel } from '../../lib/categories'
import { downloadCsv, transactionRows } from '../../lib/csv'
import { byNewest, getQuincenaRange, isSameMonth, parseDate } from '../../lib/dates'
import { dayHeading, signedNet } from '../../lib/days'
import { formatDate, formatMonth, monthName } from '../../lib/format'
import { currencies, formatMoney, getTotals } from '../../lib/money'
import { paymentMethods, totalsByMethod } from '../../lib/payment'
import { filterTransactions, hasFilters } from '../../lib/search'
import { useToday } from '../../lib/useToday'
import { useSettings } from '../../context/useSettings'
import EmptyState from '../../components/EmptyState'
import TransactionItem from '../../components/TransactionItem'

// The query as shown in the "nothing found" title: short, on one line
const QUERY_SHOWN = 30

// A money figure with its sign: income "+" in the income colour, spending "−"
// in the text colour, zero muted with no sign
function Figure({ amount, code, kind }) {
  if (!(amount > 0)) {
    return <span className="nowrap is-zero">{formatMoney(0, code)}</span>
  }
  return kind === 'income' ? (
    <span className="nowrap income">+{formatMoney(amount, code)}</span>
  ) : (
    <span className="nowrap">−{formatMoney(amount, code)}</span>
  )
}

// Colour of the net of a day: income green when positive, plain when negative,
// muted at zero
function netClass(net) {
  if (net === 0) return 'nowrap is-zero'
  return net > 0 ? 'nowrap income' : 'nowrap'
}

export default function HistoryScreen() {
  const { lang, locale, t } = useSettings()
  const { transactions, categories, quincenaSchedule } = useTransactions()

  const today = useToday()
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [method, setMethod] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const filters = { query, type, categoryId, method }
  const filtering = hasFilters(filters)
  // an active type, category or method filter can never be hidden
  const open =
    showFilters || type !== 'all' || categoryId !== 'all' || method !== 'all'
  const activeFilters = [type, categoryId, method].filter((v) => v !== 'all').length

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
    setShowFilters(false)
  }

  // Filtering searches every month; otherwise it is the month on screen
  const list = (
    filtering
      ? filterTransactions(transactions, filters, categories, t)
      : transactions.filter((tx) => isSameMonth(parseDate(tx.date), month))
  ).sort(byNewest)

  // one group per day, newest first, with the day's net per currency (never a
  // total across currencies)
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
  const methodTotals = totalsByMethod(transactions, quincena)
  const showMethods = !filtering && isSameMonth(month, today)

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

  if (transactions.length === 0) {
    return (
      <>
        <h1 className="screen-title">{t('history')}</h1>
        <div className="narrow">
          <EmptyState />
        </div>
      </>
    )
  }

  const shownQuery =
    query.trim().length > QUERY_SHOWN
      ? `${query.trim().slice(0, QUERY_SHOWN)}…`
      : query.trim()

  return (
    <>
      <h1 className="screen-title">{t('history')}</h1>

      <div className="narrow">
        {!filtering && (
          <div className="month-nav">
            <button
              type="button"
              className="month-btn"
              aria-label={t('prevMonth')}
              onClick={() => changeMonth(-1)}
            >
              ‹
            </button>
            <h2 className="month-name">{formatMonth(month, locale)}</h2>
            <button
              type="button"
              className="month-btn"
              aria-label={t('nextMonth')}
              disabled={!canGoNext}
              onClick={() => changeMonth(1)}
            >
              ›
            </button>
          </div>
        )}

        {summaries.length > 0 && (
          <section className="summary hist-summary">
            {summaries.map((s) => (
              <div className="hist-line" key={s.code}>
                <span className="hist-cur">{t(s.labelKey)}</span>
                <span className="hist-fig">
                  <span className="sub">{t('income')}</span>
                  <Figure amount={s.income} code={s.code} kind="income" />
                </span>
                <span className="hist-fig">
                  <span className="sub">{t('spent')}</span>
                  <Figure amount={s.spent} code={s.code} kind="spent" />
                </span>
              </div>
            ))}
          </section>
        )}

        <label className="field">
          <span className="label">{t('search')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchHint')}
          />
        </label>

        <div className="pill-group">
          <button
            type="button"
            className={open ? 'pill active' : 'pill'}
            aria-expanded={open}
            onClick={() => setShowFilters((v) => !v)}
          >
            {t('filters')}
            {activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
          {filtering && (
            <button type="button" className="pill" onClick={clearFilters}>
              {t('clearFilters')}
            </button>
          )}
        </div>

        {open && (
          <section className="card filter-panel">
            <div className="filter-group">
              <p className="label" id="filter-type-label">{t('type')}</p>
              <div className="pill-group" role="group" aria-labelledby="filter-type-label">
                {[
                  ['all', t('all')],
                  ['expense', t('typeExpense')],
                  ['income', t('typeIncome')],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={type === value ? 'pill active' : 'pill'}
                    aria-pressed={type === value}
                    onClick={() => setType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <p className="label" id="filter-method-label">{t('paymentMethod')}</p>
              <div
                className="pill-group wrap"
                role="group"
                aria-labelledby="filter-method-label"
              >
                {[
                  ['all', t('all')],
                  ...paymentMethods.map((m) => [m.code, t(m.labelKey)]),
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={method === value ? 'pill active' : 'pill'}
                    aria-pressed={method === value}
                    onClick={() => setMethod(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span className="label">{t('category')}</span>
              <select
                value={categoryId}
                onChange={(e) =>
                  setCategoryId(
                    e.target.value === 'all' ? 'all' : Number(e.target.value),
                  )
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
          <section className="card day-group" key={day.date}>
            <header className="day-head">
              <h2 className="day-title">
                {dayHeading(day.date, today, locale, t, {
                  // results can span years
                  year: filtering,
                })}
              </h2>
              {/* net of the day per currency: + income colour, − plain, zero muted */}
              <span className="day-total">
                {day.totals.map((c) => (
                  <span className={netClass(c.net)} key={c.code}>
                    {signedNet(c.net, c.code)}
                  </span>
                ))}
              </span>
            </header>
            <ul className="list">
              {day.items.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} showDate={false} />
              ))}
            </ul>
          </section>
        ))}

        {showMethods && (
          <section className="card">
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
                    {currencies.map((c) => (
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

        {list.length > 0 && (
          <section className="card">
            <h2 className="section-title">{t('data')}</h2>
            <div className="actions">
              <button type="button" className="btn secondary" onClick={handleExport}>
                {filtering ? t('exportResults') : t('exportCsv')}
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
