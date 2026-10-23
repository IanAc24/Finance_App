import { categoryColor, categoryLabel } from '../lib/categories'
import { sum } from '../lib/money'
import { shareText } from '../lib/moneyDisplay'
import { useSettings } from '../context/useSettings'

// A category needs at least this share of the bar to carry its % inside
const LABEL_MIN_SHARE = 15

// The bar of one currency: segments sized by share, the % inside the wide
// ones, and a legend with a dot, the name and the % of every category (so the
// colour is never the only signal). `totals` is a list of { category, total }
// of ONE currency. Shares come from shareText, the same function the category
// rows use, so the bar, the legend and the rows always agree.
export default function SpendBar({ totals }) {
  const { t } = useSettings()
  const all = sum(totals.map((item) => item.total))

  return (
    <div className="spend-block">
      <div className="spend-bar" aria-hidden="true">
        {totals.map(({ category, total }) => (
          <span
            key={category.id}
            style={{ flexGrow: (total / all) * 100, background: categoryColor(category) }}
          >
            {(total / all) * 100 >= LABEL_MIN_SHARE && shareText(total, all)}
          </span>
        ))}
      </div>
      <ul className="spend-legend" aria-label={t('legendLabel')}>
        {totals.map(({ category, total }) => (
          <li key={category.id}>
            <span className="spend-dot" style={{ background: categoryColor(category) }} />
            <span>{categoryLabel(category, t)}</span>
            <span className="spend-pct">{shareText(total, all)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
