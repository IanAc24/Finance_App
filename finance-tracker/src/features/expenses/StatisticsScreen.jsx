import { useState } from 'react'
import { useTransactions } from '../../context/useTransactions'
import { byNewest, parseDate } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import {
  getCategoryTotals,
  getPeriodStart,
  getQuincenaHistory,
  getSpendingBars,
  trimQuincenaHistory,
} from '../../lib/stats'
import { formatMoney } from '../../lib/money'
import { useSettings } from '../../context/useSettings'
import BarChart from '../../components/BarChart'
import CategoryBars from '../../components/CategoryBars'
import CurrencyPills from '../../components/CurrencyPills'
import EmptyState from '../../components/EmptyState'
import TransactionItem from '../../components/TransactionItem'

export default function StatisticsScreen() {
  const { locale, t } = useSettings()
  const [period, setPeriod] = useState('week')
  const [currency, setCurrency] = useState('CRC')
  const { transactions, categories, savings, quincenaSchedule } =
    useTransactions()

  const today = new Date()
  const bars = getSpendingBars(transactions, currency, period, today, locale)
  // same range as the chart: last 7 days, 6 months or 3 years
  const periodStart = getPeriodStart(period)
  const byCategory = getCategoryTotals(
    transactions.filter(
      (tx) =>
        tx.type === 'expense' &&
        tx.currency === currency &&
        parseDate(tx.date) >= periodStart &&
        parseDate(tx.date) <= today,
    ),
    categories,
  ).sort((a, b) => b.total - a.total)
  // newest first: the first one is the quincena in progress (it is part of
  // this list on purpose, so the section is named "Your quincenas")
  const history = trimQuincenaHistory(
    getQuincenaHistory(
      transactions,
      currency,
      6,
      today,
      savings,
      quincenaSchedule,
    ),
    transactions,
    currency,
  )
  const shortDate = (date) => formatDate(date, locale, { year: false })
  const recent = transactions
    .filter((tx) => tx.currency === currency)
    .sort(byNewest)
    .slice(0, 8)

  if (transactions.length === 0) {
    return (
      <>
        <h1 className="screen-title">{t('statistics')}</h1>
        <div className="narrow">
          <EmptyState illustration="chart" />
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="screen-title">{t('statistics')}</h1>

      <div className="pill-group center">
        {['week', 'month', 'year'].map((p) => (
          <button
            key={p}
            type="button"
            className={period === p ? 'pill active' : 'pill'}
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {t(p)}
          </button>
        ))}
      </div>

      <div className="center-pills">
        <CurrencyPills value={currency} onChange={setCurrency} />
      </div>

      <div className="cols">
        <div className="col">
          <section className="card">
            <h2 className="section-title">{t('spending')}</h2>
            <BarChart
              bars={bars}
              formatValue={(value) => formatMoney(value, currency)}
            />
          </section>

          <section className="card">
            <h2 className="section-title">{t('pastQuincenas')}</h2>
            {history.length === 0 ? (
              <p className="sub empty">{t('noTransactionsCurrency')}</p>
            ) : (
              <ul className="list">
                {history.map((q, index) => (
                  <li className="row" key={q.start.getTime()}>
                    <div>
                      <p className="row-name">
                        {shortDate(q.start)} – {shortDate(q.end)}
                        {index === 0 && (
                          <span className="tag">{t('thisQuincena')}</span>
                        )}
                      </p>
                      <p className="row-meta figures">
                        {/* a zero is muted and has no sign */}
                        {q.income > 0 ? (
                          <span className="nowrap income">
                            +{formatMoney(q.income, currency)}
                          </span>
                        ) : (
                          <span className="nowrap is-zero">
                            {formatMoney(0, currency)}
                          </span>
                        )}
                        {' · '}
                        {q.spent > 0 ? (
                          <span className="nowrap">−{formatMoney(q.spent, currency)}</span>
                        ) : (
                          <span className="nowrap is-zero">
                            {formatMoney(0, currency)}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className={q.net < 0 ? 'row-amount spending' : 'row-amount'}>
                      {formatMoney(q.net, currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="col">
          <section className="card">
            <h2 className="section-title">{t('byCategory')}</h2>
            {byCategory.length === 0 ? (
              <p className="sub empty">{t('noSpending')}</p>
            ) : (
              <CategoryBars totals={byCategory} currency={currency} />
            )}
          </section>

          <section className="card">
            <h2 className="section-title">{t('transactions')}</h2>
            {recent.length === 0 ? (
              <p className="sub empty">{t('noTransactionsCurrency')}</p>
            ) : (
              <ul className="list">
                {recent.map((tx) => (
                  <TransactionItem key={tx.id} tx={tx} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
