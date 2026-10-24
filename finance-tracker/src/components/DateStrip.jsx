import { useEffect, useRef } from 'react'
import { parseDate } from '../lib/dates'
import { lastDays } from '../lib/days'
import { formatDate } from '../lib/format'
import { useSettings } from '../context/useSettings'
import { Icon } from './CategoryIcon'

// The last 7 days, ending today, as a strip you can slide sideways: weekday and
// number on each, the chosen one with a ring. The strip starts scrolled to the
// end so today is in view. The last tile, "Otra fecha", opens the date field
// (the screen draws it). `value` is the chosen 'YYYY-MM-DD'.
export default function DateStrip({ today, value, onChange, otherOpen, onToggleOther }) {
  const { locale, t } = useSettings()
  const strip = useRef(null)
  const days = lastDays(today, 7)
  const todayText = days[days.length - 1]

  // today (the last tile) in view when the screen opens
  useEffect(() => {
    const node = strip.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [])

  return (
    <div className="date-strip" role="group" aria-label={t('date')} ref={strip}>
      {days.map((day) => {
        const date = parseDate(day)
        const chosen = value === day && !otherOpen
        return (
          <button
            key={day}
            type="button"
            className={chosen ? 'date-tile active' : 'date-tile'}
            aria-pressed={chosen}
            aria-label={formatDate(date, locale, { weekday: true })}
            onClick={() => onChange(day)}
          >
            <span className="date-tile-day" aria-hidden="true">
              {day === todayText
                ? t('today')
                : date.toLocaleDateString(locale, { weekday: 'short' })}
            </span>
            <span className="date-tile-number" aria-hidden="true">
              {date.getDate()}
            </span>
          </button>
        )
      })}
      <button
        type="button"
        className={otherOpen ? 'date-tile is-other active' : 'date-tile is-other'}
        aria-pressed={otherOpen}
        onClick={onToggleOther}
      >
        <span className="date-tile-day" aria-hidden="true">
          <Icon name="calendar" size={18} />
        </span>
        <span className="date-tile-number date-tile-text">{t('otherDate')}</span>
      </button>
    </div>
  )
}
