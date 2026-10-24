import { useEffect, useRef } from 'react'
import { categoryLabel } from '../lib/categories'
import { useSettings } from '../context/useSettings'
import CategoryIcon, { Icon } from './CategoryIcon'

// The categories as one row of round icons with their name under each that
// slides sideways on phones (and wraps from 900px). The chosen one has a ring
// and a bold name, and is brought into view when the row appears. The last
// tile, "Otra", means a new category typed by the person: `value` is null
// while it is chosen (the screen then shows the name field).
export default function CategoryRow({ categories, value, onChange }) {
  const { t } = useSettings()
  const row = useRef(null)

  // the chosen category in view when the row is long (one jump, no animation)
  useEffect(() => {
    const node = row.current
    const active = node?.querySelector('[aria-pressed="true"]')
    if (!node || !active) return
    const left = active.offsetLeft - (node.clientWidth - active.offsetWidth) / 2
    node.scrollLeft = Math.max(0, left)
  }, [])

  return (
    <div className="cat-row" role="group" aria-label={t('category')} ref={row}>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={value === c.id ? 'cat-tile is-on' : 'cat-tile'}
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
        >
          <CategoryIcon category={c} size={44} />
          <span>{categoryLabel(c, t)}</span>
        </button>
      ))}
      <button
        type="button"
        className={value === null ? 'cat-tile is-on' : 'cat-tile'}
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        <span className="cat-icon is-large is-other" aria-hidden="true">
          <Icon name="plus" size={24} />
        </span>
        <span>{t('customCategory')}</span>
      </button>
    </div>
  )
}
