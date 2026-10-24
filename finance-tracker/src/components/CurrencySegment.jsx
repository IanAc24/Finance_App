import { currencies } from '../lib/money'

// CRC | USD with a thumb that slides to the active one (transform only). The
// buttons are a group of toggles like the other segmented controls.
export function CurrencySegment({ value, onChange, label }) {
  const index = Math.max(0, currencies.findIndex((c) => c.code === value))
  return (
    <div className="cur-seg" role="group" aria-label={label}>
      <span
        className="cur-seg-thumb"
        aria-hidden="true"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {currencies.map(({ code }) => (
        <button
          key={code}
          type="button"
          className={value === code ? 'is-on' : undefined}
          aria-pressed={value === code}
          onClick={() => onChange(code)}
        >
          {code}
        </button>
      ))}
    </div>
  )
}

// One panel per currency in the same place: the active one fades in and the
// other fades out (opacity), so a total is never shown mixed with another and
// the height is the tallest of the two (no layout shift). The inactive panel
// is inert: hidden from screen readers and the keyboard.
//   panels: { CRC: node, USD: node }
export function CurrencyPanels({ active, panels }) {
  return (
    <div className="cur-panels">
      {currencies.map(({ code }) => (
        <div
          key={code}
          className={active === code ? 'cur-panel is-active' : 'cur-panel'}
          inert={active !== code}
        >
          {panels[code]}
        </div>
      ))}
    </div>
  )
}
