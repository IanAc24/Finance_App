import { useMemo, useRef, useState } from 'react'
import { byNewest, getQuincenaRange, parseDate } from '../../lib/dates'
import { dateWithYear, deleteMessage, signedAmount } from '../../lib/describe'
import { dayTitle } from '../../lib/days'
import { periodRange } from '../../lib/income'
import { planSavingsMove } from '../../lib/goals'
import { useListTransitions } from '../../lib/motion'
import { formatMoney } from '../../lib/money'
import { savingsBalance, savingsInRange } from '../../lib/savings'
import { periodSurplus } from '../../lib/savingsReport'
import {
  allGoalsReached,
  fillTemplate,
  goalProgress,
  moveOutcome,
  nextGoal,
  pigFill,
  reachedGoals,
} from '../../lib/savingsUi'
import { useToday } from '../../lib/useToday'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { useToast } from '../../context/useToast'
import { useTransactions } from '../../context/useTransactions'
import CategoryIcon, { Icon } from '../../components/CategoryIcon'
import CountUpMoney from '../../components/CountUpMoney'
import { CurrencySegment } from '../../components/CurrencySegment'
import PiggyBank from '../../components/PiggyBank'
import Sheet from '../../components/Sheet'
import TransitionRow from '../../components/TransitionRow'
import GoalForm from './GoalForm'
import GoalsCard from './GoalsCard'
import MoveForm from './MoveForm'
import YearReport from './YearReport'

// What identifies a move for the list animations, and what makes it "edited"
const rowKey = (move) => move.id
const rowSignature = (move) => `${move.amount}|${move.direction}|${move.date}|${move.note}`

// The Savings screen: the piggy bank and the real savings balance of ONE
// currency (CRC and USD are never mixed), the estimated leftover of the month
// (clearly NOT savings), deposit / withdraw, goals, the movements, the yearly
// report and the way into the annual recap.
//
// Motion: a coin and the milestone are played only from the answer of one
// confirmed write (see moveOutcome), never from a render. While the coin is
// still travelling the numbers on screen are HELD at their old values (`hold`)
// and released when it lands, so the balance, the level and the bars move
// after the coin, not before.
export default function SavingsScreen() {
  const { locale, t } = useSettings()
  const { confirm, alert } = useDialog()
  const toast = useToast()
  const {
    transactions,
    savings,
    goals,
    quincenaSchedule,
    profile,
    saveSavingsMove,
    deleteSavingsMove,
    addGoal,
    updateGoal,
    deleteGoal,
  } = useTransactions()
  const today = useToday()

  const [currency, setCurrency] = useState(profile.currency)
  // the sheet: its content is kept while it closes so it can fade out
  const [sheet, setSheet] = useState(null) // { key, kind: 'in' | 'out' | 'goal', goal }
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetCount = useRef(0)
  const [hold, setHold] = useState(null)
  const [pinFill, setPinFill] = useState(null)
  const [pendingIds, setPendingIds] = useState([])
  const [busy, setBusy] = useState(false)
  const piggy = useRef(null)

  const balance = savingsBalance(savings, currency)
  const goalsHere = goals.filter((goal) => goal.currency === currency)
  const target = nextGoal(goals, currency)
  const holding = hold && hold.currency === currency ? hold : null

  // what is shown: the held values while a coin is on its way
  const shownBalance = holding ? holding.balance : balance
  const fill = pinFill ?? (holding ? holding.fill : pigFill(balance, target, allGoalsReached(goals, currency)))
  const isEmpty = !savings.some((move) => move.currency === currency)
  const progress = target ? goalProgress(target, shownBalance) : null

  const month = periodRange('month', today)
  const surplus = periodSurplus(transactions, month.from, month.to, currency)

  // the quincena goal of the welcome, in its currency
  const quincenaGoal = profile.savingsGoal && profile.currency === currency
  const { start, end } = getQuincenaRange(today, quincenaSchedule)
  const savedNow = savingsInRange(savings, currency, start, end).toSavings

  // ---- Saving a move --------------------------------------------------------

  const openSheet = (kind, goal = null) => {
    sheetCount.current += 1
    setSheet({ key: sheetCount.current, kind, goal })
    setSheetOpen(true)
  }

  // Called by the form. Holds the numbers, waits for the server (up to 8 s)
  // and answers the form as soon as the write has an answer, so the sheet
  // closes while the coin plays. Throws when the write fails.
  const submitMove = async (move) => {
    const plan = planSavingsMove(move, savings, goals)
    setHold({
      currency: move.currency,
      balance: savingsBalance(savings, move.currency),
      fill: pigFill(
        savingsBalance(savings, move.currency),
        nextGoal(goals, move.currency),
        allGoalsReached(goals, move.currency),
      ),
      reachedIds: plan.ok ? plan.achieveGoalIds : [],
    })
    let result
    try {
      result = await saveSavingsMove(move, { awaitServer: true })
    } catch (error) {
      setHold(null)
      throw error
    }
    playOutcome(move, result)
    return result
  }

  // What happens after a saved move. Not awaited by the form.
  const playOutcome = async (move, result) => {
    const outcome = moveOutcome({
      direction: move.direction,
      status: result.status,
      achievedGoalIds: result.achievedGoalIds,
    })
    const amount = formatMoney(move.amount, move.currency)

    if (outcome.animation === null) {
      // no answer from the server yet: nothing moves, nothing is celebrated
      setHold(null)
      setPendingIds((ids) => [...ids, move.id])
      toast.show({ message: t('svToastPending'), kind: 'info' })
      return
    }

    if (outcome.animation === 'deposit') {
      await piggy.current?.playDeposit({ squash: !outcome.celebrate })
    } else {
      await piggy.current?.playWithdraw()
    }
    // the coin is in (or out): now the numbers move
    setHold(null)

    if (outcome.message === 'deposit') {
      toast.show({ message: fillTemplate(t('svToastDeposit'), { amount }), kind: 'success' })
    } else if (outcome.message === 'withdraw') {
      toast.show({ message: fillTemplate(t('svToastWithdraw'), { amount }), kind: 'info' })
    } else {
      // the goals this write reached (they are marked in the provider already)
      const reached = reachedGoals(result.achievedGoalIds, goals)
      const message =
        reached.length === 1
          ? fillTemplate(t('svToastGoal'), {
              name: reached[0].name,
              amount: formatMoney(reached[0].target, reached[0].currency),
            })
          : fillTemplate(t('svToastGoals'), { names: reached.map((goal) => goal.name).join(', ') })
      toast.show({ message, kind: 'success' })
    }

    if (outcome.celebrate) {
      // the piggy stays full while it celebrates, then settles on the next goal
      setPinFill(1)
      await piggy.current?.playCelebrate()
      setPinFill(null)
    }
  }

  // ---- Goals ------------------------------------------------------------------

  const submitGoal = async ({ id, name, target: amount }) => {
    const editing = sheet?.goal
    const result = editing
      ? await updateGoal(editing.id, { name, target: amount }, { awaitServer: true })
      : await addGoal({ id, name, target: amount, currency }, { awaitServer: true })
    toast.show(
      result.status === 'confirmed'
        ? { message: editing ? t('svGoalUpdated') : t('svGoalCreated'), kind: 'success' }
        : { message: t('svToastPending'), kind: 'info' },
    )
  }

  const handleDeleteGoal = async (goal) => {
    const { confirmed } = await confirm({
      message: fillTemplate(t('svConfirmDeleteGoal'), {
        name: goal.name,
        amount: formatMoney(goal.target, goal.currency),
      }),
      confirmLabel: t('delete'),
      danger: true,
    })
    if (!confirmed) return
    try {
      await deleteGoal(goal.id)
    } catch (error) {
      console.error(error)
      await alert(t('saveError'))
    }
  }

  // ---- Movements --------------------------------------------------------------

  // the name a movement shows: its note, or what kind of move it was
  const moveName = (item) =>
    item.note || (item.direction === 'in' ? t('moveToSavings') : t('takeFromSavings'))

  // deleting an old move is how a mistake is corrected, so the balance may go
  // below zero
  const handleDeleteMove = async (item) => {
    if (busy) return
    const { confirmed } = await confirm({
      message: deleteMessage(t('confirmDeleteMove'), {
        name: moveName(item),
        amount: signedAmount(item.direction === 'in' ? '+' : '−', item.amount, item.currency),
        date: dateWithYear(parseDate(item.date), today, locale),
      }),
      confirmLabel: t('delete'),
      danger: true,
    })
    if (!confirmed) return
    setBusy(true)
    try {
      await deleteSavingsMove(item.id)
    } catch (error) {
      console.error(error)
      await alert(t('saveError'))
    }
    setBusy(false)
  }

  const moves = useMemo(
    () => savings.filter((move) => move.currency === currency).sort(byNewest),
    [savings, currency],
  )
  // a new row rises in, a deleted one fades and closes up; switching currency
  // never animates
  const { stateOf, ghosts } = useListTransitions(moves, {
    id: 'savings',
    scope: currency,
    getKey: rowKey,
    getSignature: rowSignature,
  })
  const days = []
  for (const move of [...moves, ...ghosts].sort(byNewest)) {
    const last = days[days.length - 1]
    if (last && last.date === move.date) last.items.push(move)
    else days.push({ date: move.date, items: [move] })
  }

  // ---- Sheet ---------------------------------------------------------------------

  const sheetTitle =
    sheet?.kind === 'goal'
      ? sheet.goal
        ? t('svGoalEdit')
        : t('svGoalNew')
      : sheet?.kind === 'out'
        ? t('svWithdrawTitle')
        : t('svDepositTitle')

  return (
    <div className="sv-screen">
      <div className="hist-headrow">
        <h1 className="hist-title">{t('savings')}</h1>
        <CurrencySegment value={currency} onChange={setCurrency} label={t('currencyLabel')} />
      </div>

      <div className="sv-cols">
        <div className="sv-side">
          <section className="card sv-hero" aria-labelledby="sv-real-label">
            <PiggyBank
              ref={piggy}
              fill={fill}
              currency={currency}
              empty={isEmpty}
            />
            {isEmpty && <p className="sub sv-invite">{t('piggyEmpty')}</p>}

            <div className="sv-balance">
              <p className="label" id="sv-real-label">
                {t('svReal')}
              </p>
              <CountUpMoney amount={shownBalance} currency={currency} />
              {target && (
                <p className="sub sv-toward">
                  {fillTemplate(t('svTowardGoal'), {
                    name: target.name,
                    percent: progress.percent,
                  })}
                </p>
              )}
              {quincenaGoal && (
                <>
                  <p className="sub sv-toward">
                    {t('savingsGoalPerQuincena')}: {formatMoney(profile.savingsGoal, currency)}
                  </p>
                  <p className="sub sv-toward">
                    {t('savedThisQuincena')}: {formatMoney(savedNow, currency)}
                  </p>
                </>
              )}
            </div>

            <div className="sv-actions">
              <button type="button" className="btn" onClick={() => openSheet('in')}>
                {t('svDeposit')}
              </button>
              <button type="button" className="btn secondary" onClick={() => openSheet('out')}>
                {t('svWithdraw')}
              </button>
            </div>

            <div className="sv-surplus">
              <p className="label">{t('svSurplus')}</p>
              <CountUpMoney amount={surplus} currency={currency} className="sv-fig" />
              <p className="sub">{t('svSurplusNote')}</p>
            </div>
          </section>

          <GoalsCard
            goals={goalsHere}
            balance={shownBalance}
            holding={holding ? holding.reachedIds : []}
            onAdd={() => openSheet('goal')}
            onEdit={(goal) => openSheet('goal', goal)}
            onDelete={handleDeleteGoal}
          />
        </div>

        <div className="sv-main">
          <section className="card sv-moves" aria-labelledby="sv-moves-title">
            <h2 className="section-title" id="sv-moves-title">
              {t('movements')}
            </h2>
            {days.length === 0 ? (
              <p className="sub sv-moves-empty">{t('noSavingsYet')}</p>
            ) : (
              days.map((day) => (
                <section
                  className="day-group"
                  key={day.date}
                  aria-labelledby={`sv-day-${day.date}`}
                >
                  <header className="day-head">
                    <h3 className="day-title" id={`sv-day-${day.date}`}>
                      {dayTitle(day.date, today, locale, t, { year: true })}
                    </h3>
                  </header>
                  <ul className="hist-rows">
                    {day.items.map((item) => (
                      <TransitionRow key={item.id} state={stateOf(rowKey(item))}>
                        <div className="hist-row sv-row">
                          <CategoryIcon kind={item.direction === 'in' ? 'savings' : 'savingsOut'} />
                          <span className="hist-row-text">
                            <span className="hist-row-name">{moveName(item)}</span>
                            {pendingIds.includes(item.id) && (
                              <span className="hist-row-meta sv-pending">{t('svPending')}</span>
                            )}
                          </span>
                          <span
                            className={
                              item.direction === 'in'
                                ? 'hist-row-amount sv-in'
                                : 'hist-row-amount sv-out'
                            }
                          >
                            {item.direction === 'in' ? '+' : '−'}
                            {formatMoney(item.amount, item.currency)}
                          </span>
                          <button
                            type="button"
                            className="icon-btn is-small"
                            aria-label={`${t('delete')}: ${moveName(item)}`}
                            disabled={busy}
                            onClick={() => handleDeleteMove(item)}
                          >
                            <Icon name="trash" size={18} />
                          </button>
                        </div>
                      </TransitionRow>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </section>

          <YearReport
            transactions={transactions}
            savings={savings}
            goals={goals}
            currency={currency}
            today={today}
          />
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        keep
        className="sheet-soft"
        onClose={() => setSheetOpen(false)}
        title={sheetTitle}
      >
        {sheet?.kind === 'goal' ? (
          <GoalForm
            key={sheet.key}
            goal={sheet.goal}
            currency={currency}
            onSubmit={submitGoal}
            onDone={() => setSheetOpen(false)}
          />
        ) : sheet ? (
          <MoveForm
            key={sheet.key}
            direction={sheet.kind}
            currency={currency}
            balance={balance}
            today={today}
            onSubmit={submitMove}
            onDone={() => setSheetOpen(false)}
          />
        ) : null}
      </Sheet>
    </div>
  )
}
