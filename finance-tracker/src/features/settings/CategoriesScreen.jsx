import { useState } from 'react'
import {
  categoryColors,
  categoryLabel,
  cleanCategoryName,
  findCategoryByName,
} from '../../lib/categories'
import { MAX_CATEGORY_NAME_LENGTH } from '../../lib/limits'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import CategoryIcon from '../../components/CategoryIcon'
import SubHeader from '../../components/SubHeader'

function CategoryEditor({ category, onDone }) {
  const { t } = useSettings()
  const { confirm } = useDialog()
  const { transactions, categories, updateCategory, deleteCategory } =
    useTransactions()

  const others = categories.filter((c) => c.id !== category.id)
  const used = transactions.filter((tx) => tx.categoryId === category.id).length

  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const [moveTo, setMoveTo] = useState(String(others[0].id))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const trimmedName = cleanCategoryName(name)
  const clash = findCategoryByName(others, name)
  const canSave = trimmedName !== '' && !clash && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(false)
    try {
      await updateCategory(category.id, { name: trimmedName, color })
      onDone()
    } catch (error) {
      console.error(error)
      setSaving(false)
      setSaveError(true)
    }
  }

  const handleDelete = async () => {
    if (saving) return
    const { confirmed } = await confirm({
      message: t('confirmDeleteCategory'),
      confirmLabel: t('deleteCategory'),
      danger: true,
    })
    if (!confirmed) return
    // with no transactions nothing moves; the id only has to exist
    const moveToId = used > 0 ? Number(moveTo) : others[0].id
    setSaving(true)
    setSaveError(false)
    try {
      await deleteCategory(category.id, moveToId)
      onDone()
    } catch (error) {
      console.error(error)
      setSaving(false)
      setSaveError(true)
    }
  }

  return (
    <div className="editor">
      <label className="field">
        <span className="label">{t('categoryName')}</span>
        <input
          type="text"
          value={name}
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {clash && <p className="field-note error" role="alert">{t('categoryExists')}</p>}

      <p className="label">{t('color')}</p>
      <div className="swatches">
        {categoryColors.map((c) => (
          <button
            key={c}
            type="button"
            className={color === c ? 'swatch active' : 'swatch'}
            style={{ background: `var(--cat-${c})` }}
            aria-label={t(`color.${c}`)}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      {used > 0 && (
        <label className="field">
          <span className="label">
            {used === 1 ? t('moveToOne') : t('moveTo').replace('{n}', used)}
          </span>
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c, t)}
              </option>
            ))}
          </select>
        </label>
      )}

      {saveError && <p className="field-note error" role="alert">{t('saveError')}</p>}

      <div className="actions">
        <button
          type="button"
          className="btn"
          disabled={!canSave}
          onClick={handleSave}
        >
          {t('save')}
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={saving}
          onClick={handleDelete}
        >
          {t('deleteCategory')}
        </button>
      </div>
    </div>
  )
}

// The form of a new category: a name, saved with the same function (and so the
// same colour rule) the Add screen uses for its "Custom" category
function NewCategory({ onDone }) {
  const { t } = useSettings()
  const { categories, addCategory } = useTransactions()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const trimmedName = cleanCategoryName(name)
  const clash = findCategoryByName(categories, name)
  const canSave = trimmedName !== '' && !clash && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(false)
    try {
      await addCategory(trimmedName)
      onDone()
    } catch (error) {
      console.error(error)
      setSaving(false)
      setSaveError(true)
    }
  }

  return (
    <div className="editor">
      <label className="field">
        <span className="label">{t('categoryName')}</span>
        <input
          type="text"
          autoFocus
          value={name}
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
          }}
        />
      </label>
      {clash && <p className="field-note error" role="alert">{t('categoryExists')}</p>}
      {saveError && <p className="field-note error" role="alert">{t('saveError')}</p>}
      <div className="actions">
        <button type="button" className="btn" disabled={!canSave} onClick={handleSave}>
          {t('save')}
        </button>
        <button type="button" className="btn secondary" disabled={saving} onClick={onDone}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}

export default function CategoriesScreen() {
  const { t } = useSettings()
  const { categories } = useTransactions()
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)

  const hasCustom = categories.some((c) => c.name)

  return (
    <>
      <SubHeader to="/settings" backLabel={t('settings')} title={t('categories')} />

      <div className="narrow">
        <section className="card">
          <ul className="list">
            {categories.map((c) => (
              <li key={c.id}>
                <div className="tx-row">
                  <CategoryIcon category={c} />
                  <span className="tx-text">
                    <span className="tx-name">{categoryLabel(c, t)}</span>
                    {!c.name && <span className="tx-meta">{t('builtIn')}</span>}
                  </span>
                  {c.name && (
                    <button
                      type="button"
                      className="pill"
                      aria-expanded={editingId === c.id}
                      onClick={() =>
                        setEditingId(editingId === c.id ? null : c.id)
                      }
                    >
                      {editingId === c.id ? t('cancel') : t('edit')}
                    </button>
                  )}
                </div>
                {editingId === c.id && (
                  <CategoryEditor
                    key={c.id}
                    category={c}
                    onDone={() => setEditingId(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>

        {creating ? (
          <section className="card">
            <h2 className="section-title">{t('newCategory')}</h2>
            <NewCategory onDone={() => setCreating(false)} />
          </section>
        ) : (
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setEditingId(null)
              setCreating(true)
            }}
          >
            {t('newCategory')}
          </button>
        )}

        {!hasCustom && <p className="sub empty">{t('noCustomCategories')}</p>}
      </div>
    </>
  )
}
