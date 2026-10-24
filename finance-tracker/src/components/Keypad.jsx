import { useSettings } from '../context/useSettings'
import { keypadKeys } from '../lib/keypad'
import { Icon } from './CategoryIcon'

// The number keys in the order of a phone: 1 2 3 / 4 5 6 / 7 8 9 and then
// "000" (the decimal point for dollars), 0 and delete. Soft round keys; the
// screen puts its Save key right below.
export default function Keypad({ onKey, currency }) {
  const { t } = useSettings()

  return (
    <div className="keypad">
      {keypadKeys(currency).map((key) => (
        <button
          type="button"
          key={key}
          className="key"
          onClick={() => onKey(key)}
          aria-label={key === '⌫' ? t('deleteDigit') : undefined}
        >
          {key === '⌫' ? <Icon name="delete" size={24} /> : key}
        </button>
      ))}
    </div>
  )
}
