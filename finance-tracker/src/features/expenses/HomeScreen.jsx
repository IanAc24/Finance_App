import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions } from '../../context/useTransactions'
import {
  byNewest,
  daysBetween,
  daysLeftInQuincena,
  getQuincenaRange,
  parseDate,
  quincenaKey,
  todayString,
} from '../../lib/dates'
import { formatDate } from '../../lib/format'
import { useToday } from '../../lib/useToday'
import { currencies, formatMoney } from '../../lib/money'
import { isBackupReminderDue } from '../../lib/backup'
import { readPref, writePref } from '../../lib/prefs'
import { quincenaFigures, rolloverLeftover } from '../../lib/quincena'
import { manualState, registerPayday } from '../../lib/quincenaSchedule'
import { isDue, isHandled } from '../../lib/recurring'
import {
  ROLLOVER_NOTE,
  previousQuincenaRange,
  rolloverSkipKey,
  savingsBalance,
} from '../../lib/savings'
import { getCategoryTotals } from '../../lib/stats'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import CategoryBars from '../../components/CategoryBars'
import EmptyState from '../../components/EmptyState'
import RecurringRow from '../../components/RecurringRow'
import TransactionItem from '../../components/TransactionItem'

export default function HomeScreen() {
  const { locale, t } = useSettings()
  const { alert, confirm } = useDialog()

  const today = useToday()
  const {
    quincenaSchedule,
    transactions,
    categories,
    budgets,
    recurring,
    savings,
    profile,
    saveQuincenaSchedule,
    confirmRecurring,
    skipRecurring,
    addSavingsMove,
  } = useTransactions()
  const { start, end } = getQuincenaRange(today, quincenaSchedule)
  const daysLeft = daysLeftInQuincena(today, quincenaSchedule)
  const [busy, setBusy] = useState(false)
  // manual pay days: the date being typed for "another date", or null
  const [otherDate, setOtherDate] = useState(null)
  const [paidError, setPaidError] = useState(null)
  // the quincena each currency's rollover offer was skipped for
  const [skipped, setSkipped] = useState(() =>
    Object.fromEntries(currencies.map((c) => [c.code, readPref(rolloverSkipKey(c.code))])),
  )
  const current = transactions.filter((tx) => {
    const date = parseDate(tx.date)
    return date >= start && date <= end
  })
  const recent = [...transactions]
    .sort(byNewest)
    .slice(0, 5)

  const due = recurring.filter((item) => isDue(item, today, quincenaSchedule))
  const handled = recurring.filter((item) =>
    isHandled(item, today, quincenaSchedule),
  )

  // last quincena's leftover is offered once per currency
  const previous = previousQuincenaRange(today, quincenaSchedule)
  const previousKey = quincenaKey(previous.start, quincenaSchedule)
  const offers = currencies
    .map(({ code, labelKey }) => ({
      code,
      labelKey,
      // an income dated on the closing day is not a leftover (see lib/quincena)
      leftover: rolloverLeftover(
        { transactions, savings, quincenaSchedule },
        code,
        today,
      ),
    }))
    .filter(({ code, leftover }) => leftover > 0 && skipped[code] !== previousKey)

  // one action at a time; a failed write is reported, not swallowed
  const run = async (action) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error(error)
      await alert(t('saveError'))
    } finally {
      setBusy(false)
    }
  }

  // dated the last day of the previous quincena, so that period closes at
  // zero and this quincena is not touched
  const moveLeftover = (code, leftover) =>
    run(() =>
      addSavingsMove({
        amount: leftover,
        currency: code,
        direction: 'in',
        note: ROLLOVER_NOTE,
        date: todayString(previous.end),
      }),
    )

  const skipLeftover = (code) =>
    run(async () => {
      writePref(rolloverSkipKey(code), previousKey)
      setSkipped((prev) => ({ ...prev, [code]: previousKey }))
    })

  const manual = manualState(quincenaSchedule, today)

  // "I was paid": a new quincena starts on that day (today unless another
  // date was typed); a date that would move the past is explained, not saved
  const registerPaid = async (dateText) => {
    // here the person says they WERE paid: a day that has not come is an error
    // (in Settings and the welcome a future day is the next payment)
    const result =
      dateText > todayString(today)
        ? { ok: false, reason: 'future' }
        : registerPayday(quincenaSchedule, dateText, today)
    if (!result.ok) {
      setPaidError(result.reason)
      return
    }
    // two payments a few days apart are usually a double tap
    if (
      manual.active &&
      manual.since !== dateText &&
      daysBetween(parseDate(manual.since), parseDate(dateText)) < 3
    ) {
      const { confirmed } = await confirm({
        message: t('manualPaidAgain').replace(
          '{date}',
          formatDate(parseDate(manual.since), locale),
        ),
        confirmLabel: t('manualPaidRegister'),
      })
      if (!confirmed) return
    }
    setPaidError(null)
    setOtherDate(null)
    run(() => saveQuincenaSchedule(result.schedule))
  }

  const rangeText = `${formatDate(start, locale, { year: false })} – ${formatDate(end, locale, { year: false })}`

  // a currency gets a card when it has transactions, pending bills or savings
  // moves; the first one is highlighted
  const shown = currencies
    .map((c) => ({
      ...c,
      // due bills are not transactions yet, but the money is spoken for
      ...quincenaFigures(
        { transactions, savings, recurring, quincenaSchedule, profile },
        c.code,
        today,
      ),
    }))
    .filter(
      (c) =>
        c.count > 0 || c.pending > 0 || c.toSavings > 0 || c.fromSavings > 0,
    )

  const renderCard = (
    {
      code,
      labelKey,
      income,
      spent,
      left,
      pending,
      toSavings,
      fromSavings,
      later,
      laterIncome,
      status,
      perDay,
      perDayFull,
      reserve,
    },
    index,
  ) => {
    const expenses = current.filter(
      (tx) => tx.currency === code && tx.type === 'expense',
    )
    const pct =
      income > 0 ? Math.min(Math.round((spent / income) * 100), 100) : 0
    const categoryTotals = getCategoryTotals(expenses, categories)
    const daysText = manual.overdue
      ? t('waitingPay')
      : daysLeft === 1
        ? t('lastDay')
        : `${daysLeft} ${t('daysLeft')}`

    // the headline is what can be spent today; without income (or money from
    // savings) there is no daily amount, so it shows what is left instead
    const hasBase = income > 0 || fromSavings > 0
    const message = {
      pendingExceeds: t('pendingExceeds'),
      waitingIncome: t('waitingIncome'),
      over: t('overQuincena'),
    }[status]

    return (
      <section className={index === 0 ? 'card hero' : 'card'} key={code}>
        <p className="label">
          {hasBase ? t('canSpendToday') : t('leftThisQuincena')} · {t(labelKey)}
        </p>
        {hasBase ? (
          <>
            <p className={status === 'ok' ? 'balance' : 'balance has-message'}>
              {formatMoney(perDay, code)}
            </p>
            {message && (
              <p className="sub warn" role="status">
                {message}
              </p>
            )}
            {status === 'ok' && reserve > 0 && (
              <p className="sub" data-testid="goal-note">
                {perDay === 0
                  ? t('goalUsesAll')
                  : t('goalReserveNote')
                      .replace('{reserve}', formatMoney(perDayFull - perDay, code))
                      .replace('{limit}', formatMoney(perDayFull, code))}
              </p>
            )}
            <p className="sub">
              {daysText}
              {pending > 0 &&
                ` · ${t('afterPending')} ${formatMoney(pending, code)}`}
            </p>
            <div className="left-line">
              <span className="label">{t('leftThisQuincena')}</span>
              <span className="left-amount">{formatMoney(left, code)}</span>
            </div>
          </>
        ) : (
          <>
            <p className="balance">{formatMoney(left, code)}</p>
            {pending > 0 && (
              <p className="sub">
                {t('pendingBills')} {formatMoney(pending, code)}
              </p>
            )}
          </>
        )}

        {income > 0 && (
          <>
            <div className="progress" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="sub">
              {pct}% {t('ofIncomeSpent')}
            </p>
          </>
        )}
        {later > 0 && (
          <p className="sub">
            {t('includesLater')} {formatMoney(later, code)}
          </p>
        )}
        {laterIncome > 0 && (
          <p className="sub">
            {t('includesLaterIncome')} {formatMoney(laterIncome, code)}
          </p>
        )}

        <div className="stats-row">
          <div>
            <p className="label">{t('income')}</p>
            <p className="stat income">+{formatMoney(income, code)}</p>
          </div>
          <div>
            <p className="label">{t('spent')}</p>
            <p className="stat spending">
              {spent > 0 ? '−' : ''}
              {formatMoney(spent, code)}
            </p>
          </div>
        </div>

        {(toSavings > 0 || fromSavings > 0) && (
          <div className="stats-row">
            {toSavings > 0 && (
              <div>
                <p className="label">{t('toSavings')}</p>
                <p className="stat">−{formatMoney(toSavings, code)}</p>
              </div>
            )}
            {fromSavings > 0 && (
              <div>
                <p className="label">{t('fromSavings')}</p>
                <p className="stat">+{formatMoney(fromSavings, code)}</p>
              </div>
            )}
          </div>
        )}

        {categoryTotals.length > 0 && (
          <CategoryBars
            className="list divider"
            totals={categoryTotals}
            currency={code}
            budgets={budgets.filter((b) => b.currency === code)}
            limit={index === 0 ? undefined : 3}
          />
        )}
      </section>
    )
  }

  const balancesText =
    currencies
      .map(({ code }) => ({ code, balance: savingsBalance(savings, code) }))
      .filter(({ balance }) => balance !== 0)
      .map(({ code, balance }) => formatMoney(balance, code))
      .join(' · ') || formatMoney(0, 'CRC')

  const totalDays = daysBetween(start, end) + 1
  // a late manual quincena has no known end: show it as its last day
  const dayNumber = manual.overdue ? totalDays : totalDays - daysLeft + 1

  // the leftover of the quincena that closed: shown right after the main card
  const offersCard = offers.length > 0 && (
    <section className="card">
      <p className="label">{t('lastQuincenaLeft')}</p>
      <ul className="list">
        {offers.map(({ code, labelKey, leftover }) => (
          <li key={code}>
            <div className="row">
              <span className="row-name">
                {t('moveItToSavings')} ({t(labelKey)})
              </span>
              <span className="row-amount">{formatMoney(leftover, code)}</span>
            </div>
            <div className="due-actions">
              <button
                type="button"
                className="pill active"
                disabled={busy}
                onClick={() => moveLeftover(code, leftover)}
              >
                {t('moveToSavings')}
              </button>
              <button
                type="button"
                className="pill"
                disabled={busy}
                onClick={() => skipLeftover(code)}
              >
                {t('skip')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <>
      <div className="greeting">
        {profile.name && (
          <p className="hello">
            {t('hello')}, {profile.name}
          </p>
        )}
        <h1 className="screen-title">
          {t('quincena')} · {rangeText}
        </h1>
        <p className="sub">
          {t('day')} {dayNumber} {t('dayOf')} {totalDays}
        </p>
        <div
          className="day-bar"
          role="img"
          aria-label={`${t('day')} ${dayNumber} ${t('dayOf')} ${totalDays}`}
        >
          {Array.from({ length: totalDays }, (_, i) => (
            <span
              key={i}
              className={
                i < dayNumber - 1 ? 'on' : i === dayNumber - 1 ? 'now' : undefined
              }
            />
          ))}
        </div>
      </div>

      {isBackupReminderDue(readPref('lastBackup'), transactions, today) && (
        <p className="sub backup-line">
          {t('backupReminder')}{' '}
          <Link className="text-link" to="/settings">
            {t('goToBackup')}
          </Link>
        </p>
      )}

      <div className="cols">
        <div className="col">
          {manual.active && (
            <section className="card manual-card" aria-busy={busy}>
              <p className="label">{t('manualCardTitle')}</p>
              <p className="sub">
                {t('manualSince')} {formatDate(parseDate(manual.since), locale)}
              </p>
              {manual.overdue ? (
                <p className="sub warn" role="status">
                  {t('manualOverdue')}
                </p>
              ) : (
                <p className="sub">{t('manualHint')}</p>
              )}
              <div className="due-actions">
                <button
                  type="button"
                  className="pill active"
                  disabled={busy}
                  onClick={() => registerPaid(todayString(today))}
                >
                  {t('manualPaidToday')}
                </button>
                <button
                  type="button"
                  className="pill"
                  aria-expanded={otherDate !== null}
                  onClick={() => {
                    setPaidError(null)
                    setOtherDate(otherDate === null ? todayString(today) : null)
                  }}
                >
                  {t('manualPaidOther')}
                </button>
              </div>
              {otherDate !== null && (
                <>
                  <label className="field">
                    <span className="label">{t('quincenaPaidOn')}</span>
                    <input
                      type="date"
                      max={todayString(today)}
                      value={otherDate}
                      aria-invalid={paidError !== null}
                      aria-describedby={paidError ? 'home-paid-error' : undefined}
                      onChange={(e) => {
                        setOtherDate(e.target.value)
                        setPaidError(null)
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => registerPaid(otherDate)}
                  >
                    {t('manualPaidRegister')}
                  </button>
                </>
              )}
              {paidError && (
                <p className="field-note error" role="alert" id="home-paid-error">
                  {t(
                    {
                      invalid: 'quincenaPaidInvalid',
                      future: 'quincenaPaidFuture',
                      early: 'quincenaPaidEarly',
                    }[paidError],
                  )}
                </p>
              )}
            </section>
          )}

          {shown.slice(0, 1).map((c) => renderCard(c, 0))}

          {offersCard}

          {shown.slice(1).map((c, i) => renderCard(c, i + 1))}

          {(transactions.length > 0 || savings.length > 0) && (
            <Link className="card link-card" to="/savings">
              <span className="row-name">{t('savings')}</span>
              <span className="row-amount">{balancesText}</span>
            </Link>
          )}
        </div>

        <div className="col">
          {(due.length > 0 || handled.length > 0) && (
            <section className="card">
              <p className="label">{t('dueThisQuincena')}</p>
              {transactions.length === 0 && due.length > 0 && (
                <p className="sub">{t('obHomeHint')}</p>
              )}
              <ul className="list">
                {due.map((item) => (
                  <li key={item.id}>
                    <RecurringRow item={item} />
                    <div className="due-actions">
                      <button
                        type="button"
                        className="pill active"
                        disabled={busy}
                        onClick={() => run(() => confirmRecurring(item))}
                      >
                        {t('confirm')}
                      </button>
                      <button
                        type="button"
                        className="pill"
                        disabled={busy}
                        onClick={() => run(() => skipRecurring(item))}
                      >
                        {t('skip')}
                      </button>
                    </div>
                  </li>
                ))}
                {handled.map((item) => (
                  <li key={item.id}>
                    <RecurringRow item={item} />
                    <p className="due-done">✓ {t('done')}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {shown.length === 0 && (
            <EmptyState
              actions={false}
              text={
                transactions.length === 0 ? t('emptyAll') : t('emptyQuincena')
              }
            />
          )}

          <div className="btn-row">
            <Link className="btn" to="/add?type=expense">
              {t('addExpense')}
            </Link>
            <Link className="btn secondary" to="/add?type=income">
              {t('addIncome')}
            </Link>
          </div>

          {recent.length > 0 && (
            <section className="card">
              <p className="label">{t('recent')}</p>
              <ul className="list">
                {recent.map((tx) => (
                  <TransactionItem key={tx.id} tx={tx} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

    </>
  )
}
