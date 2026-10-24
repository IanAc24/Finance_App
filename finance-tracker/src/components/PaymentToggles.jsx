import { paymentMethods } from '../lib/payment'
import { useSettings } from '../context/useSettings'
import { Icon } from './CategoryIcon'

// The icon of each payment method
const ICONS = { cash: 'banknote', card: 'creditCard', sinpe: 'smartphone' }

// Cash, card or SINPE as three round icon toggles in a row. The one that is
// on also shows its name next to the icon (so it is not a guess); each button
// has its name for screen readers and aria-pressed.
export default function PaymentToggles({ value, onChange }) {
  const { t } = useSettings()

  return (
    <div className="pay-toggles" role="group" aria-label={t('paymentMethod')}>
      {paymentMethods.map(({ code, labelKey }) => {
        const on = value === code
        return (
          <button
            key={code}
            type="button"
            className={on ? 'pay-toggle is-on' : 'pay-toggle'}
            aria-pressed={on}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => onChange(code)}
          >
            <Icon name={ICONS[code]} size={22} />
            {on && <span className="pay-toggle-label">{t(labelKey)}</span>}
          </button>
        )
      })}
    </div>
  )
}
