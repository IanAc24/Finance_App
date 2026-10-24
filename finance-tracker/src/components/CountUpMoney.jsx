import { useCountUp } from '../lib/motion'
import { formatMoney } from '../lib/money'
import Money from './Money'

// A big money figure that counts from the number on screen to the new `amount`
// when it changes (never from 0 on the first load, never with reduced motion).
// Every frame is a correctly formatted amount of `currency`. Screen readers get
// only the final amount, in a visually hidden text; the moving digits are
// aria-hidden. The final amount also sets the width (an invisible copy), so the
// figure never shifts the layout while it counts.
//   income: shows a "+" in the income colour (a total of income)
export default function CountUpMoney({ amount, currency, income = false, className = '' }) {
  const shown = useCountUp(amount)
  // an income total reads "+₡1.000"; zero has no sign and is muted
  const sign = income && amount > 0 ? '+' : ''
  const finalText = sign + formatMoney(amount, currency)
  const frameText = sign + formatMoney(shown, currency)
  const classes = [
    'countup',
    sign && 'is-income',
    amount === 0 && 'is-zero',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes}>
      <span className="sr-only">{finalText}</span>
      <span className="countup-stage" aria-hidden="true">
        {/* invisible copy of the final amount: it reserves the width */}
        <span className="countup-size">
          <Money text={finalText} />
        </span>
        <span className="countup-frame">
          <Money text={frameText} />
        </span>
      </span>
    </span>
  )
}
