import { formatMoney } from '../lib/money'
import { THIN } from '../lib/moneyDisplay'

// A money figure with its sign: income "+" in the income colour, spending "−"
// in the text colour, zero muted with no sign. The thin space keeps the sign
// apart from the number but on the same line (the figure never breaks).
export default function Figure({ amount, code, kind }) {
  if (!(amount > 0)) {
    return <span className="nowrap is-zero">{formatMoney(0, code)}</span>
  }
  return kind === 'income' ? (
    <span className="nowrap income">
      +{THIN}
      {formatMoney(amount, code)}
    </span>
  ) : (
    <span className="nowrap">
      −{THIN}
      {formatMoney(amount, code)}
    </span>
  )
}
