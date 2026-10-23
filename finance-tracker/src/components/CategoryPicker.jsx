import { categoryLabel } from '../lib/categories'
import { useSettings } from '../context/useSettings'
import CategoryIcon, { Icon } from './CategoryIcon'

// The categories as a grid of big icon circles with their name under each
// (4 per row on phones). The chosen one has a ring and a soft background.
// The last tile, "Otra", means a new category typed by the person: `value`
// is null while it is chosen (the screen then shows the name field).
export default function CategoryPicker({ categories, value, onChange }) {
  const { t } = useSettings()

  return (
    <div className="cat-grid" role="group" aria-label={t('category')}>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={value === c.id ? 'cat-tile active' : 'cat-tile'}
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
        >
          <CategoryIcon category={c} size={44} />
          <span className="cat-tile-label">{categoryLabel(c, t)}</span>
        </button>
      ))}
      <button
        type="button"
        className={value === null ? 'cat-tile active' : 'cat-tile'}
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        <span className="cat-icon is-large is-other" aria-hidden="true">
          <Icon name="plus" size={24} />
        </span>
        <span className="cat-tile-label">{t('customCategory')}</span>
      </button>
    </div>
  )
}
