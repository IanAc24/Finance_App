import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import { byNewest, isValidDate, parseDate, todayString } from '../../lib/dates'
import { dayTitle } from '../../lib/days'
import { formatDate, formatMonth } from '../../lib/format'
import { rememberedFor } from '../../lib/incomeFilters'
import { INCOME_SOURCES, incomeSummary, periodRange, sourceLabelKey } from '../../lib/income'
import { useListTransitions } from '../../lib/motion'
import { currencies, formatMoney, sum } from '../../lib/money'
import { readPref } from '../../lib/prefs'
import { useToday } from '../../lib/useToday'
import CategoryIcon, { Icon } from '../../components/CategoryIcon'
import CountUpMoney from '../../components/CountUpMoney'
import { CurrencyPanels, CurrencySegment } from '../../components/CurrencySegment'
import EmptyState from '../../components/EmptyState'
import Figure from '../../components/Figure'
import HistoryRow from '../../components/HistoryRow'

// The periods the person can look at
const PERIODS = [
  ['month', 'periodMonth'],
  ['year', 'periodYear'],
  ['custom', 'periodCustom'],
]

// What identifies a row for the list animations, and what makes it "edited"
const rowKey = (tx) => tx.id
const rowSignature = (tx) => `${tx.amount}|${tx.currency}|${tx.date}|${tx.note}|${tx.source}`

const withCount = (t, count) =>
  (count === 1 ? t('incomeCountOne') : t('incomeCount')).replace('{count}', String(count))

// What the person was looking at, kept while the app stays open: opening an
// income to edit it unmounts this screen, and coming back must find the same
// period, currency and filters (a reload starts fresh)
// (kept per signed-in account: another account never inherits them)
let remembered = null

// The currency first shown: the one of the income just added, else the one
// being looked at, else the one of the last movement added, else the profile's
function firstCurrency(fromState, profileCurrency, recalled) {
  const saved = readPref('lastCurrency')
  const known = (code) => currencies.some((c) => c.code === code)
  if (known(fromState)) return fromState
  if (known(recalled?.currency)) return recalled.currency
  return known(saved) ? saved : profileCurrency
}

// Income on its own screen: how much came in during a period (this month, this
// year or a range), per currency and per source, and the list of those income
// entries. CRC and USD are never added together: one currency at a time.
export default function IncomeScreen() {
  const { locale, t } = useSettings()
  const { transactions, profile } = useTransactions()
  const today = useToday()
  const location = useLocation()
  const { user } = useAuth()
  const uid = user?.uid ?? null
  // read once, when this screen mounts, for the account that is signed in
  const [recalled] = useState(() => rememberedFor(remembered, uid))

  const [period, setPeriod] = useState(() => recalled?.period ?? 'month')
  const [customFrom, setCustomFrom] = useState(
    () => recalled?.customFrom ?? `${today.getFullYear()}-01-01`,
  )
  const [customTo, setCustomTo] = useState(() => recalled?.customTo ?? todayString(today))
  const [currency, setCurrency] = useState(() =>
    firstCurrency(location.state?.currency, profile.currency, recalled),
  )
  const [source, setSource] = useState(() => recalled?.source ?? 'all')
  const [query, setQuery] = useState(() => recalled?.query ?? '')

  useEffect(() => {
    remembered = { uid, period, customFrom, customTo, currency, source, query }
  }, [uid, period, customFrom, customTo, currency, source, query])

  // the range on view; null while a custom range is not valid
  const customOk = isValidDate(customFrom) && isValidDate(customTo) && customFrom <= customTo
  const found =
    period === 'custom'
      ? customOk
        ? periodRange({ from: customFrom, to: customTo }, today)
        : null
      : periodRange(period, today)
  // plain strings, so the memos below do not run again on every render
  const from = found?.from ?? null
  const to = found?.to ?? null
  const range = from && to ? { from, to } : null

  const summary = useMemo(
    () => (from && to ? incomeSummary(transactions, { from, to }) : null),
    [transactions, from, to],
  )
  const current = summary?.[currency]
  const otherCurrency = currencies.find((c) => c.code !== currency)
  const other = summary?.[otherCurrency.code]
  const anyIncome = !!summary && currencies.some((c) => summary[c.code].count > 0)

  // the income entries of the period in the chosen currency, with the filters
  const needle = query.trim().toLowerCase()
  const items = useMemo(() => {
    if (!from || !to) return []
    return transactions
      .filter(
        (tx) =>
          tx.type === 'income' &&
          tx.currency === currency &&
          tx.date >= from &&
          tx.date <= to &&
          (source === 'all' || (tx.source ?? 'none') === source) &&
          (needle === '' || (tx.note ?? '').toLowerCase().includes(needle)),
      )
      .sort(byNewest)
  }, [transactions, from, to, currency, source, needle])

  // rows that animate: a new one rises in, an edited one is tinted, a deleted
  // one fades and closes up. A different period, currency or filter never does.
  const { stateOf, ghosts } = useListTransitions(items, {
    id: 'income',
    scope: `${from}|${to}|${currency}|${source}|${needle}`,
    getKey: rowKey,
    getSignature: rowSignature,
  })

  // one group per day, newest first (the ghosts of deleted rows keep their day)
  const days = []
  for (const tx of [...items, ...ghosts].sort(byNewest)) {
    const last = days[days.length - 1]
    if (last && last.date === tx.date) last.items.push(tx)
    else days.push({ date: tx.date, items: [tx] })
  }

  const periodText = !range
    ? ''
    : period === 'month'
      ? formatMonth(today, locale)
      : period === 'year'
        ? String(today.getFullYear())
        : `${formatDate(parseDate(from), locale)} – ${formatDate(parseDate(to), locale)}`

  // sources that exist in this currency and period, to filter by them
  const sourceChips = [
    ['all', t('all')],
    ...INCOME_SOURCES.map((s) => [s, t(sourceLabelKey(s))]),
    ...(current?.bySource.none > 0 ? [['none', t('sourceNone')]] : []),
  ]

  const rows = current
    ? [...INCOME_SOURCES, 'none'].filter((key) => current.bySource[key] > 0)
    : []

  const filtering = source !== 'all' || needle !== ''
  const clearFilters = () => {
    setSource('all')
    setQuery('')
  }

  const addButton = (
    <Link className="btn income-add" to="/add?type=income" state={{ from: '/income' }}>
      <Icon name="plus" size={20} stroke={2.5} />
      <span>{t('addIncome')}</span>
    </Link>
  )

  return (
    <div className="income-screen">
      <div className="hist-headrow">
        <h1 className="hist-title">{t('income')}</h1>
        {addButton}
      </div>

      <div className="income-cols">
        <div className="income-side">
          <div className="hist-chip-row" role="group" aria-label={t('periodLabel')}>
            {PERIODS.map(([value, key]) => (
              <button
                key={value}
                type="button"
                className={period === value ? 'chip is-on' : 'chip'}
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
              >
                {t(key)}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="income-range">
              <label className="field">
                <span className="label">{t('periodFrom')}</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="label">{t('periodTo')}</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
              {!customOk && (
                <p className="field-note error" role="alert">
                  {t('periodInvalid')}
                </p>
              )}
            </div>
          )}

          {summary && (
            <section className="summary income-summary" aria-labelledby="income-total-label">
              <div className="income-sum-top">
                <div className="income-sum-title">
                  <p className="label" id="income-total-label">
                    {t('incomeTotal')}
                  </p>
                  <p className="sub income-period">{periodText}</p>
                </div>
                <CurrencySegment
                  value={currency}
                  onChange={setCurrency}
                  label={t('currencyLabel')}
                />
              </div>

              {/* both currencies stacked in one place: switching crossfades,
                  and a total is never shown mixed with the other currency */}
              <CurrencyPanels
                active={currency}
                panels={Object.fromEntries(
                  currencies.map((c) => [
                    c.code,
                    <div className="income-total" key={c.code}>
                      <CountUpMoney
                        amount={summary[c.code].total}
                        currency={c.code}
                        income
                      />
                      <p className="sub">{withCount(t, summary[c.code].count)}</p>
                    </div>,
                  ]),
                )}
              />

              {other.count > 0 && (
                <p className="sub income-other">
                  {t(otherCurrency.code === 'USD' ? 'otherCurrencyUsd' : 'otherCurrencyCrc').replace(
                    '{amount}',
                    formatMoney(other.total, otherCurrency.code),
                  )}
                </p>
              )}

              {rows.length > 0 && (
                <div className="income-sources" key={currency}>
                  <h2 className="label">{t('incomeBySource')}</h2>
                  <ul className="source-list">
                    {rows.map((key) => (
                      <li key={key} className="source-row">
                        <CategoryIcon kind="income" source={key} size={36} />
                        <span className="source-name">{t(sourceLabelKey(key))}</span>
                        <Figure amount={current.bySource[key]} code={currency} kind="income" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="income-main">
          {range && anyIncome && (
            <>
              <div className="hist-chip-row" role="group" aria-label={t('incomeSourceFilter')}>
                {sourceChips.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={source === value ? 'chip is-on' : 'chip'}
                    aria-pressed={source === value}
                    onClick={() => setSource(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="hist-search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  aria-label={t('incomeSearch')}
                  placeholder={t('incomeSearch')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </>
          )}

          {range && !anyIncome && (
            <EmptyState
              card
              actions={false}
              illustration="income"
              title={t('incomeEmptyTitle')}
              text={t('incomeEmptyText')}
            >
              {addButton}
            </EmptyState>
          )}

          {range && anyIncome && current.count === 0 && (
            <p className="sub income-none">
              {t('incomeEmptyCurrency').replace('{currency}', currency)}
            </p>
          )}

          {range && current?.count > 0 && days.length === 0 && filtering && (
            <EmptyState
              card
              actions={false}
              illustration="search"
              title={t('incomeNoResults')}
              text={t('noResultsText')}
            >
              <button type="button" className="btn secondary" onClick={clearFilters}>
                {t('clearFilters')}
              </button>
            </EmptyState>
          )}

          {days.length > 0 && <h2 className="sr-only">{t('incomeHistory')}</h2>}

          {days.map((day) => {
            const live = day.items.filter((tx) => stateOf(rowKey(tx)) !== 'leave')
            return (
              <section
                className="day-group"
                key={day.date}
                aria-labelledby={`income-day-${day.date}`}
              >
                <header className="day-head">
                  <h2 className="day-title" id={`income-day-${day.date}`}>
                    {dayTitle(day.date, today, locale, t, { year: period !== 'month' })}
                  </h2>
                  <span className="day-total">
                    <Figure
                      amount={sum(live.map((tx) => tx.amount))}
                      code={currency}
                      kind="income"
                    />
                  </span>
                </header>
                <ul className="hist-rows">
                  {day.items.map((tx) => (
                    <HistoryRow key={tx.id} tx={tx} category={undefined} motion={stateOf(rowKey(tx))} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
