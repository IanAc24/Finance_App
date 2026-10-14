import { useState } from 'react'
import { useTransactions } from '../../context/useTransactions'
import { categoryLabel } from '../../lib/categories'
import { downloadCsv, transactionRows } from '../../lib/csv'
import { byNewest, getQuincenaRange, isSameMonth, parseDate } from '../../lib/dates'
import { formatDate, formatMonth } from '../../lib/format'
import { currencies, formatMoney, getTotals } from '../../lib/money'
import { paymentMethods, totalsByMethod } from '../../lib/payment'
import { filterTransactions, hasFilters } from '../../lib/search'
import { useSettings } from '../../context/useSettings'
import EmptyState from '../../components/EmptyState'
import TransactionItem from '../../components/TransactionItem'

export default function HistoryScreen() {
  const { lang, locale, t } = useSettings()
  const { transactions, categories, quincenaSchedule } = useTransactions()

  const today = new Date()
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

  // one group per day, newest first
  const days = []
  for (const tx of list) {
    const last = days[days.length - 1]
    if (last && last.date === tx.date) last.items.push(tx)
    else days.push({ date: tx.date, items: [tx] })
  }

  // spending per payment method in the quincena of today; it ignores the
  // filters so the three methods can always be compared
  const quincena = getQuincenaRange(today, quincenaSchedule)
  const methodTotals = totalsByMethod(transactions, quincena)

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
            <p className="month-name">
              {formatMonth(month, locale)}
            </p>
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
          </button>
          {filtering && (
            <button type="button" className="pill" onClick={clearFilters}>
              {t('clearFilters')}
            </button>
          )}
        </div>

        {open && (
          <>
            <div className="pill-group">
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

            <div className="pill-group payment">
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
          </>
        )}
      </div>

      <div className="cols">
        <div className="col">
          {list.length > 0 && (
            <section className="card">
              {summaries.map((s, index) => (
                <div className={index === 0 ? undefined : 'divider'} key={s.code}>
                  <p className="label">
                    {t('balance')} · {t(s.labelKey)}
                  </p>
                  <p className="month-balance">{formatMoney(s.net, s.code)}</p>
                  <div className="stats-row">
                    <div>
                      <p className="label">{t('income')}</p>
                      <p className="stat income">
                        +{formatMoney(s.income, s.code)}
                      </p>
                    </div>
                    <div>
                      <p className="label">{t('spent')}</p>
                      <p className="stat spending">
                        {s.spent > 0 ? '−' : ''}
                        {formatMoney(s.spent, s.code)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="card">
            <p className="label">
              {t('spentByMethod')} · {t('quincena')}
            </p>
            <p className="sub">
              {formatDate(quincena.start, locale, { year: false })} –{' '}
              {formatDate(quincena.end, locale, { year: false })}
            </p>
            <ul className="list">
              {methodTotals.map((m) => (
                <li className="row" key={m.code}>
                  <span>{t(m.labelKey)}</span>
                  <span className="sub day-totals">
                    {currencies.map((c) => (
                      <span className="spending" key={c.code}>
                        {formatMoney(m[c.code].spent, c.code)}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <p className="label">{t('data')}</p>
            <div className="actions">
              <button
                type="button"
                className="btn secondary"
                disabled={list.length === 0}
                onClick={handleExport}
              >
                {filtering ? t('exportResults') : t('exportCsv')}
              </button>
            </div>
          </section>
        </div>

        <div className="col">
          {list.length === 0 ? (
            <section className="card">
              <p className="sub empty">
                {filtering ? t('noResults') : t('noTransactions')}
              </p>
            </section>
          ) : (
            <section className="card">
              {days.map((day, index) => (
                <div className={index === 0 ? undefined : 'divider'} key={day.date}>
                  <div className="row">
                    <p className="label">
                      {formatDate(parseDate(day.date), locale, {
                        weekday: true,
                        // results can span years
                        year: filtering,
                      })}
                    </p>
                    {/* net of the day per currency: + income color, − spending */}
                    <p className="sub day-totals">
                      {currencies
                        .map((c) => ({ ...c, ...getTotals(day.items, c.code) }))
                        .filter((c) => c.count > 0)
                        .map((c) => (
                          <span
                            className={c.net < 0 ? 'spending' : 'income'}
                            key={c.code}
                          >
                            {c.net < 0 ? '' : '+'}
                            {formatMoney(c.net, c.code)}
                          </span>
                        ))}
                    </p>
                  </div>
                  <ul className="list">
                    {day.items.map((tx) => (
                      <TransactionItem key={tx.id} tx={tx} showDate={false} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
