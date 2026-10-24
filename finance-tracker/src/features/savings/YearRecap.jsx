import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import { currencies, formatMoney } from '../../lib/money'
import { availableYears, yearRecap } from '../../lib/savingsReport'
import { barRatios, fillTemplate } from '../../lib/savingsUi'
import { useToday } from '../../lib/useToday'
import CountUpMoney from '../../components/CountUpMoney'
import SubHeader from '../../components/SubHeader'

// Two bars that compare two amounts of one currency. The bar is a full-width
// block scaled on X (a transform: no layout work); the numbers are in the
// row labels and, for screen readers, in the aria-label of the whole figure.
function CompareBars({ rows, ariaLabel, first, kind }) {
  const [a, b] = barRatios(rows[0].value, rows[1].value)
  return (
    <div className={`rc-bars is-${kind}`} role="img" aria-label={ariaLabel}>
      {[a, b].map((ratio, index) => (
        <div className="rc-bar-row rc-reveal" key={rows[index].label} style={{ '--i': first + index }} aria-hidden="true">
          <span className="rc-bar-label">{rows[index].label}</span>
          <span className="rc-bar-track">
            <span
              className={index === 0 ? 'rc-bar-fill is-a' : 'rc-bar-fill is-b'}
              style={{ '--r': ratio, '--d': `${(first + index) * 60}ms` }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}

// One row of figures: label on the left, the amount counting up from 0 on the
// right (once, when the recap appears)
function Line({ label, amount, currency, index, note, strong }) {
  return (
    <div className={strong ? 'rc-line rc-reveal is-strong' : 'rc-line rc-reveal'} style={{ '--i': index }}>
      <dt>
        {label}
        {note && <span className="rc-line-note">{note}</span>}
      </dt>
      <dd>
        <CountUpMoney amount={amount} currency={currency} from={0} delay={index * 60} className="sv-fig" />
      </dd>
    </div>
  )
}

// The recap of one currency. Incomplete or empty years say so instead of
// showing numbers that would be invented.
function CurrencyRecap({ code, labelKey, data, order }) {
  const { t } = useSettings()
  const noData = data.reason === 'noData'
  const partial = data.reason === 'historyAfterSavings'
  const headId = `rc-${code}`
  // Position of every block in the reveal (60ms apart). Each currency starts
  // one step after the one before.
  const start = order + 6

  return (
    <section className="card rc-card" aria-labelledby={headId} data-currency={code}>
      <h2 className="rc-title rc-reveal" id={headId} style={{ '--i': order }}>
        {t(labelKey)}
      </h2>

      {noData && (
        <p className="sub rc-message rc-reveal" style={{ '--i': order + 1 }}>
          {t('rcNoData')}
        </p>
      )}
      {partial && (
        <p className="rc-message is-warning rc-reveal" role="note" style={{ '--i': order + 1 }}>
          {t('rcIncomplete')}
        </p>
      )}

      {!noData && (
        <>
          <dl className="rc-lines">
            <Line label={t('rcIncome')} amount={data.income} currency={code} index={order + 1} />
            <Line label={t('rcExpenses')} amount={data.expenses} currency={code} index={order + 2} />
            <Line
              label={t('rcSurplus')}
              amount={data.surplus}
              currency={code}
              index={order + 3}
              note={t('rcSurplusNote')}
            />
          </dl>
          <CompareBars
            first={order + 4}
            kind="flow"
            ariaLabel={fillTemplate(t('rcBarsIncome'), {
              inflow: formatMoney(data.income, code),
              outflow: formatMoney(data.expenses, code),
            })}
            rows={[
              { label: t('rcIncome'), value: data.income },
              { label: t('rcExpenses'), value: data.expenses },
            ]}
          />

          <dl className="rc-lines">
            <Line label={t('svDeposited')} amount={data.deposits} currency={code} index={start} />
            <Line label={t('svWithdrawn')} amount={data.withdrawals} currency={code} index={start + 1} />
            <Line label={t('svClosing')} amount={data.closing} currency={code} index={start + 2} strong />
          </dl>
          <CompareBars
            first={start + 3}
            kind="saving"
            ariaLabel={fillTemplate(t('rcBarsSavings'), {
              deposits: formatMoney(data.deposits, code),
              withdrawals: formatMoney(data.withdrawals, code),
            })}
            rows={[
              { label: t('svDeposited'), value: data.deposits },
              { label: t('svWithdrawn'), value: data.withdrawals },
            ]}
          />

          <div className="rc-goals rc-reveal" style={{ '--i': start + 5 }}>
            <h3 className="label">{t('rcGoals')}</h3>
            {data.goalsAchieved.length === 0 ? (
              <p className="sub">{t('rcNoGoals')}</p>
            ) : (
              <ul className="rc-goal-list">
                {data.goalsAchieved.map((goal) => (
                  <li key={goal.id}>
                    <span className="rc-goal-name">{goal.name}</span>
                    <span className="nowrap">{formatMoney(goal.target, code)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

// The annual recap (route /savings/recap/:year): per currency, side by side
// on a wide screen and stacked on a phone, never mixed. Sections appear one
// after another (60ms apart, 250ms each) and the figures count up from 0 once.
// Changing the year starts it again.
export default function YearRecap() {
  const { t } = useSettings()
  const { transactions, savings, goals } = useTransactions()
  const today = useToday()
  const { year: yearParam } = useParams()
  const year = /^\d{4}$/.test(yearParam ?? '') ? Number(yearParam) : null

  const recap = useMemo(
    () => (year === null ? null : yearRecap(transactions, savings, goals, year)),
    [transactions, savings, goals, year],
  )
  const years = useMemo(() => {
    const list = new Set([today.getFullYear(), year, ...availableYears(transactions, savings, goals)])
    return [...list].filter((value) => value !== null).sort((a, b) => b - a)
  }, [transactions, savings, goals, today, year])

  if (year === null) return <Navigate to="/savings" replace />

  return (
    <div className="rc-screen">
      <SubHeader
        to="/savings"
        backLabel={t('savings')}
        title={fillTemplate(t('rcTitle'), { year })}
      />

      {years.length > 1 && (
        <nav className="hist-chip-row" aria-label={t('year')}>
          {years.map((value) => (
            <Link
              key={value}
              to={`/savings/recap/${value}`}
              replace
              className={value === year ? 'chip is-on' : 'chip'}
              aria-current={value === year ? 'page' : undefined}
            >
              {value}
            </Link>
          ))}
        </nav>
      )}

      {/* the key starts the reveal again when the year changes */}
      <div className="rc-cols" key={year}>
        {currencies.map(({ code, labelKey }, order) => (
          <CurrencyRecap key={code} code={code} labelKey={labelKey} data={recap[code]} order={order} />
        ))}
      </div>
    </div>
  )
}
