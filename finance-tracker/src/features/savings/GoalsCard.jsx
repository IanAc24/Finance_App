import { useSettings } from '../../context/useSettings'
import { parseDate } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import { useCountUp } from '../../lib/motion'
import { formatMoney } from '../../lib/money'
import { fillTemplate, goalProgress } from '../../lib/savingsUi'
import { Icon } from '../../components/CategoryIcon'

// The percentage of a goal: counts to the new number when the balance changes
// (screen readers get the final one from the progress bar itself)
function AnimatedPercent({ value }) {
  const shown = useCountUp(value, { duration: 600 })
  return <span aria-hidden="true">{Math.round(shown)}%</span>
}

// The goals of the currency on view: name, target, a bar that fills (a
// transform, 600ms) and its percentage; "Reached on ..." for the ones done.
// `balance` is the number to measure with (the screen holds the old one while
// a coin is still travelling); `holding` lists goals whose achievement the
// screen has not shown yet, so they still read as in progress.
export default function GoalsCard({ goals, balance, holding, onAdd, onEdit, onDelete }) {
  const { locale, t } = useSettings()

  // goals in progress first (nearest first), then the ones reached (newest first)
  const sorted = [...goals].sort((a, b) => {
    const doneA = a.achievedAt && !holding.includes(a.id)
    const doneB = b.achievedAt && !holding.includes(b.id)
    if (doneA !== doneB) return doneA ? 1 : -1
    if (doneA) return b.achievedAt.localeCompare(a.achievedAt) || b.id - a.id
    return a.target - b.target || a.id - b.id
  })

  return (
    <section className="card sv-goals" aria-labelledby="sv-goals-title">
      <div className="sv-card-head">
        <h2 className="section-title" id="sv-goals-title">
          {t('svGoals')}
        </h2>
        <button type="button" className="chip" onClick={onAdd}>
          <Icon name="plus" size={18} stroke={2.5} />
          <span>{t('svGoalNew')}</span>
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="sub sv-goals-empty">{t('svGoalsEmpty')}</p>
      ) : (
        <ul className="sv-goal-list">
          {sorted.map((goal) => {
            const held = holding.includes(goal.id)
            const shown = held ? { ...goal, achievedAt: null } : goal
            const { ratio, percent } = goalProgress(shown, balance)
            const done = !!shown.achievedAt
            return (
              <li className="sv-goal" key={goal.id}>
                <div className="sv-goal-head">
                  <span className="sv-goal-name">{goal.name}</span>
                  <span className="sv-goal-actions">
                    <button
                      type="button"
                      className="icon-btn is-small"
                      aria-label={`${t('svGoalEdit')}: ${goal.name}`}
                      onClick={() => onEdit(goal)}
                    >
                      <Icon name="notePen" size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn is-small"
                      aria-label={`${t('delete')}: ${goal.name}`}
                      onClick={() => onDelete(goal)}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </span>
                </div>
                <p className="sub sv-goal-meta">
                  {done
                    ? fillTemplate(t('svGoalReached'), {
                        date: formatDate(parseDate(goal.achievedAt), locale),
                      })
                    : fillTemplate(t('svGoalOf'), {
                        current: formatMoney(Math.min(Math.max(balance, 0), goal.target), goal.currency),
                        target: formatMoney(goal.target, goal.currency),
                      })}
                </p>
                <div className="sv-goal-track">
                  <div
                    className={done ? 'sv-bar is-done' : 'sv-bar'}
                    role="progressbar"
                    aria-label={goal.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                  >
                    <span className="sv-bar-fill" style={{ '--r': ratio }} />
                  </div>
                  <span className="sv-goal-pct">
                    <AnimatedPercent value={percent} />
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
