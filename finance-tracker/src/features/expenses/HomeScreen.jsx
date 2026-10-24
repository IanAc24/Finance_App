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
import { longDate } from '../../lib/days'
import { formatDate } from '../../lib/format'
import { useToday } from '../../lib/useToday'
import { currencies, formatMoney, sum } from '../../lib/money'
import { isBackupReminderDue, isBackupReminderSnoozed, backupSnoozeUntil } from '../../lib/backup'
import { BACKUP_SNOOZE_PREF, readPref, writePref } from '../../lib/prefs'
import { quincenaFigures, rolloverLeftover } from '../../lib/quincena'
import { manualState, registerPayday } from '../../lib/quincenaSchedule'
import { isDue, isHandled } from '../../lib/recurring'
import {
  ROLLOVER_NOTE,
  previousQuincenaRange,
  rolloverSkipKey,
  savingsBalance,
} from '../../lib/savings'
import { itemName } from '../../lib/describe'
import { getCategoryTotals } from '../../lib/stats'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { useToast } from '../../context/useToast'
import CategoryBars from '../../components/CategoryBars'
import CategoryIcon, { Icon } from '../../components/CategoryIcon'
import EmptyState from '../../components/EmptyState'
import Money from '../../components/Money'
import RecentRow from '../../components/RecentRow'
import RecurringRow from '../../components/RecurringRow'
import SpendBar from '../../components/SpendBar'

export default function HomeScreen() {
  const { locale, t } = useSettings()
  const { alert, confirm } = useDialog()
  const toast = useToast()

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
  const [backupSnoozedUntil, setBackupSnoozedUntil] = useState(() => readPref(BACKUP_SNOOZE_PREF))
  // manual pay days: the date being typed for "another date", or null
  const [otherDate, setOtherDate] = useState(null)
  const [paidError, setPaidError] = useState(null)
  // the currencies whose "how it is calculated" block is open
  const [calcOpen, setCalcOpen] = useState({})
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
    run(async () => {
      await addSavingsMove({
        amount: leftover,
        currency: code,
        direction: 'in',
        note: ROLLOVER_NOTE,
        date: todayString(previous.end),
      })
      // the card disappears, so say where the money went
      toast.show({
        kind: 'success',
        message: t('toastLeftoverMoved').replace('{amount}', formatMoney(leftover, code)),
      })
    })

  const skipLeftover = (code) =>
    run(async () => {
      writePref(rolloverSkipKey(code), previousKey)
      setSkipped((prev) => ({ ...prev, [code]: previousKey }))
    })

  // "Not now" on the backup reminder: hidden for two weeks
  const snoozeBackupReminder = () => {
    const until = backupSnoozeUntil(today)
    writePref(BACKUP_SNOOZE_PREF, until)
    setBackupSnoozedUntil(until)
  }

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

  // the backup reminder shows unless it was snoozed
  const backupDue =
    !isBackupReminderSnoozed(backupSnoozedUntil, today) &&
    isBackupReminderDue(readPref('lastBackup'), transactions, today)

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

  const hasDue = due.length > 0 || handled.length > 0
  // nothing at all yet: one welcoming message instead of empty cards
  const noData =
    shown.length === 0 &&
    !hasDue &&
    transactions.length === 0 &&
    savings.length === 0
  const several = shown.length > 1

  // The summary of one currency, and the "where did the money go" block under
  // it. The first currency gets both as separate blocks (the add buttons go
  // between them); the others are one compact block with both inside.
  const build = (
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
      available,
    },
    compact,
  ) => {
    const expenses = current.filter(
      (tx) => tx.currency === code && tx.type === 'expense',
    )
    const categoryTotals = getCategoryTotals(expenses, categories)
    const isOpen = calcOpen[code] === true
    const daysText = manual.overdue
      ? t('waitingPay')
      : daysLeft === 1
        ? t('lastDayShort')
        : t('daysShort').replace('{n}', daysLeft)

    // the headline is what can be spent today; without income (or money from
    // savings) there is no daily amount, so it shows what is left instead
    const hasBase = income > 0 || fromSavings > 0
    const message = {
      pendingExceeds: t('pendingExceeds'),
      waitingIncome: t('waitingIncome'),
      over: t('overQuincena'),
    }[status]
    // "You have ₡X left" or, when more was spent than came in, "You are ₡X over"
    const sentence = (left < 0 ? t('overSentence') : t('leftSentence'))
      .replace('{amount}', formatMoney(Math.abs(left), code))
      .replace('{days}', daysText)

    const where = (
      <>
        <h2 className="section-title" id={`where-${code}`}>
          {t('whereMoneyWent')}
          {several && ` · ${t(labelKey)}`}
        </h2>
        {categoryTotals.length > 0 ? (
          <CategoryBars
            totals={categoryTotals}
            showShare={false}
            currency={code}
            budgets={budgets.filter((b) => b.currency === code)}
            limit={compact ? 3 : undefined}
          />
        ) : (
          <p className="sub">{t('nothingSpentYet')}</p>
        )}
      </>
    )

    const summary = (
      <section
        className={compact ? 'summary is-compact hs-secondary' : 'summary hs-summary'}
        key={code}
      >
        <p className="label">
          {hasBase ? t('canSpendToday') : t('leftThisQuincena')} · {t(labelKey)}
        </p>
        {hasBase ? (
          <>
            <p className={status === 'ok' ? 'summary-amount' : 'summary-amount is-muted'}>
              <Money text={formatMoney(perDay, code)} />
            </p>
            {message && (
              <p className="sub warn" role="status">
                {message}
              </p>
            )}
            <div className="summary-context">
              <p className="summary-sentence">{sentence}</p>
              <button
                type="button"
                className="calc-toggle"
                aria-expanded={isOpen}
                aria-controls={`calc-${code}`}
                onClick={() => setCalcOpen((prev) => ({ ...prev, [code]: !prev[code] }))}
              >
                {t('howCalculated')}
              </button>
            </div>
            {isOpen && (
              <div className="calc-block" id={`calc-${code}`}>
                <ul className="calc-list">
                  <li>
                    <span>{t('leftThisQuincena')}</span>
                    <span className="nowrap">{formatMoney(left, code)}</span>
                  </li>
                  {laterIncome > 0 && (
                    <li>
                      <span>{t('calcLaterIncome')}</span>
                      <span className="nowrap">−{formatMoney(laterIncome, code)}</span>
                    </li>
                  )}
                  {pending > 0 && (
                    <li>
                      <span>{t('pendingBills')}</span>
                      <span className="nowrap">−{formatMoney(pending, code)}</span>
                    </li>
                  )}
                  {reserve > 0 && (
                    <li>
                      <span>{t('calcReserve')}</span>
                      <span className="nowrap">−{formatMoney(reserve, code)}</span>
                    </li>
                  )}
                  <li className="is-total">
                    <span>{t('calcAvailable')}</span>
                    <span className="nowrap">
                      {formatMoney(Math.max(sum([available, -reserve]), 0), code)}
                    </span>
                  </li>
                  <li>
                    <span>{t('calcDivided').replace('{days}', daysText)}</span>
                    <span className="nowrap">{formatMoney(perDay, code)}</span>
                  </li>
                </ul>
                {status === 'ok' && reserve > 0 && (
                  <p className="sub" data-testid="goal-note">
                    {perDay === 0
                      ? t('goalUsesAll')
                      : t('goalReserveNote')
                          .replace('{reserve}', formatMoney(perDayFull - perDay, code))
                          .replace('{limit}', formatMoney(perDayFull, code))}
                  </p>
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
              </div>
            )}
          </>
        ) : (
          <>
            <p className="summary-amount">
              <Money text={formatMoney(left, code)} />
            </p>
            {pending > 0 && (
              <p className="sub">
                {t('pendingBills')} {formatMoney(pending, code)}
              </p>
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
          </>
        )}

        <div className="summary-stats">
          <div>
            <p className="label">{t('income')}</p>
            <p className={income > 0 ? 'stat income' : 'stat zero'}>
              {income > 0 ? '+' : ''}
              {formatMoney(income, code)}
            </p>
          </div>
          <div>
            <p className="label">{t('spent')}</p>
            <p className={spent > 0 ? 'stat' : 'stat zero'}>
              {spent > 0 ? '−' : ''}
              {formatMoney(spent, code)}
            </p>
          </div>
        </div>

        {(toSavings > 0 || fromSavings > 0) && (
          <div className="summary-stats">
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

        {/* the quincena's spending by category in one bar; the rows with
            their budgets are in "where the money went" */}
        {categoryTotals.length > 0 && <SpendBar totals={categoryTotals} />}

        {compact && <div className="summary-where">{where}</div>}
      </section>
    )

    return {
      summary,
      where: compact ? null : (
        <section
          className="card hs-where"
          aria-labelledby={`where-${code}`}
          key={`where-${code}`}
        >
          {where}
        </section>
      ),
    }
  }

  const balances = currencies
    .map(({ code }) => ({ code, balance: savingsBalance(savings, code) }))
    .filter(({ balance }) => balance !== 0)
    .map(({ code, balance }) => formatMoney(balance, code))
  if (balances.length === 0) balances.push(formatMoney(0, 'CRC'))

  const totalDays = daysBetween(start, end) + 1
  // a late manual quincena has no known end: show it as its last day
  const dayNumber = manual.overdue ? totalDays : totalDays - daysLeft + 1

  const main = shown[0] && build(shown[0], false)

  // the leftover of the quincena that closed
  const offersCard = offers.length > 0 && (
    <section className="card hs-offers">
      <h2 className="section-title">{t('lastQuincenaLeft')}</h2>
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

  const manualCard = manual.active && (
    <section className="card manual-card hs-manual" aria-busy={busy}>
      <h2 className="section-title">{t('manualCardTitle')}</h2>
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
  )

  return (
    <>
      <header className="home-head">
        <div className="home-date">
          {profile.name && (
            <p className="hello">
              {t('hello')}, {profile.name}
            </p>
          )}
          <h1>{longDate(today, locale)}</h1>
          <p className="sub">
            {t('quincena')} · {rangeText}
          </p>
        </div>
        <Link className="home-add" to="/add?type=expense" aria-label={t('addExpense')}>
          <span>{t('add')}</span>
          <Icon name="plus" size={18} stroke={2.5} />
        </Link>
      </header>
      <div className="home-day-line">
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

      {noData ? (
        <div className="home-empty">
          {manualCard}
          <EmptyState />
        </div>
      ) : (
        <div className="home-cols">
          <div className="home-col">
            {manualCard}

            {main?.summary}

            {offersCard}

            {shown.length === 0 && (
              <div className="hs-summary">
                <EmptyState
                  card
                  actions={false}
                  text={
                    transactions.length === 0 ? t('emptyAll') : t('emptyQuincena')
                  }
                />
              </div>
            )}

            {main?.where}

            {shown.slice(1).map((c) => build(c, true).summary)}
          </div>

          <div className="home-col">
            {hasDue && (
              <section className="card hs-due">
                <h2 className="section-title">{t('dueThisQuincena')}</h2>
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
                          aria-label={`${t('confirm')} ${itemName(item, categories, t)}`}
                          onClick={() => run(() => confirmRecurring(item))}
                        >
                          {t('confirm')}
                        </button>
                        <button
                          type="button"
                          className="pill"
                          disabled={busy}
                          aria-label={`${t('skip')} ${itemName(item, categories, t)}`}
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

            {recent.length > 0 && (
              <section className="home-section hs-recent">
                <h2 className="section-title">{t('recent')}</h2>
                <ul className="recent-list">
                  {recent.map((tx) => (
                    <RecentRow
                      key={tx.id}
                      tx={tx}
                      category={categories.find((cat) => cat.id === tx.categoryId)}
                    />
                  ))}
                </ul>
                <Link className="see-all" to="/history">
                  {t('seeAllHistory')}
                </Link>
              </section>
            )}

            {(transactions.length > 0 || savings.length > 0) && (
              <Link className="card link-card hs-savings" to="/savings">
                <CategoryIcon kind="savings" />
                <span className="tx-text">
                  <span className="tx-name">{t('savings')}</span>
                </span>
                <span className="link-card-balance">
                  {balances.map((text, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      <span className="nowrap">{text}</span>
                    </span>
                  ))}
                </span>
              </Link>
            )}

            {backupDue && (
              <section className="card backup-card hs-backup">
                <p className="sub">{t('backupReminder')}</p>
                <div className="backup-actions">
                  <Link className="text-link" to="/settings">
                    {t('goToBackup')}
                  </Link>
                  <button
                    type="button"
                    className="text-link"
                    onClick={snoozeBackupReminder}
                  >
                    {t('backupSnooze')}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  )
}
