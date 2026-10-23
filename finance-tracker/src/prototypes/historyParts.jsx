import { formatMonth } from '../lib/format'
import { nextMonth, prevMonth } from './copy'

// Month name with the two arrows (44px each), shared by both History directions
export function MonthNav({ model }) {
  const { month, locale, canGoNext, changeMonth } = model
  return (
    <div className="proto-month">
      <button
        type="button"
        className="proto-arrow"
        aria-label={prevMonth}
        onClick={() => changeMonth(-1)}
      >
        ‹
      </button>
      <h1 className="proto-month-name">{formatMonth(month, locale)}</h1>
      <button
        type="button"
        className="proto-arrow"
        aria-label={nextMonth}
        disabled={!canGoNext}
        onClick={() => changeMonth(1)}
      >
        ›
      </button>
    </div>
  )
}
