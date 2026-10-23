import { splitMoney } from '../lib/moneyDisplay'

// A big money figure for the hero of a screen. `text` is what formatMoney
// returned, untouched: it is the accessible name, and the visible copy is the
// same text cut in pieces (small muted symbol and decimals). The whole figure
// never wraps, so the sign stays glued to its number. Long figures use a
// smaller size (is-long) instead of breaking in the middle.
export default function Money({ text, className = '' }) {
  const { sign, symbol, whole, decimals } = splitMoney(text)
  const long = sign.length + whole.length + decimals.length > 9
  const classes = ['money', long && 'is-long', className].filter(Boolean).join(' ')

  return (
    <span className={classes}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {sign}
        <span className="money-symbol">{symbol}</span>
        {whole}
        {decimals && <span className="money-decimals">{decimals}</span>}
      </span>
    </span>
  )
}
