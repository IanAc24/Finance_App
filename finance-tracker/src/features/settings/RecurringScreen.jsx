import { useState } from 'react'
import { categoryLabel } from '../../lib/categories'
import { deleteMessage, itemName, signedAmount } from '../../lib/describe'
import { MAX_NOTE_LENGTH } from '../../lib/limits'
import { parseAmount } from '../../lib/money'
import { scheduleKey, schedules } from '../../lib/recurring'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import CurrencyPills from '../../components/CurrencyPills'
import SubHeader from '../../components/SubHeader'
import EmptyState from '../../components/EmptyState'
import RecurringRow from '../../components/RecurringRow'

// item is null for a new one
function RecurringEditor({ item, onDone }) {
  const { t } = useSettings()
  const { confirm } = useDialog()
  const {
    categories,
    quincenaSchedule,
    profile,
    addRecurring,
    updateRecurring,
    deleteRecurring,
  } = useTransactions()

  const [type, setType] = useState(item?.type ?? 'expense')
  const [currency, setCurrency] = useState(item?.currency ?? profile.currency)
  const [amountText, setAmountText] = useState(item ? String(item.amount) : '')
  const [categoryId, setCategoryId] = useState(
    String(item?.categoryId ?? categories[0].id),
  )
  const [note, setNote] = useState(item?.note ?? '')
  const [schedule, setSchedule] = useState(item?.schedule ?? 'every')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const amount = parseAmount(amountText)
  const amountValid = amount !== null && amount > 0
  const canSave = amountValid && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(false)
    try {
      const fields = {
        amount,
        currency,
        type,
        categoryId: type === 'expense' ? Number(categoryId) : null,
        note: note.trim(),
        schedule,
      }
      if (item) {
        await updateRecurring(item.id, { ...fields, lastPeriod: item.lastPeriod })
      } else {
        await addRecurring(fields)
      }
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
      message: deleteMessage(t('confirmDeleteRecurring'), {
        name: itemName(item, categories, t),
        amount: signedAmount(
          item.type === 'income' ? '+' : '−',
          item.amount,
          item.currency,
        ),
      }),
      confirmLabel: t('delete'),
      danger: true,
    })
    if (!confirmed) return
    setSaving(true)
    setSaveError(false)
    try {
      await deleteRecurring(item.id)
      onDone()
    } catch (error) {
      console.error(error)
      setSaving(false)
      setSaveError(true)
    }
  }

  return (
    <div className="editor">
      <div className="pill-group">
        {['expense', 'income'].map((tp) => (
          <button
            key={tp}
            type="button"
            className={type === tp ? 'pill active' : 'pill'}
            aria-pressed={type === tp}
            onClick={() => setType(tp)}
          >
            {tp === 'expense' ? t('typeExpense') : t('typeIncome')}
          </button>
        ))}
      </div>

      <CurrencyPills value={currency} onChange={setCurrency} />

      <label className="field">
        <span className="label">{t('amount')}</span>
        <input
          type="text"
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />
      </label>
      {amountText.trim() !== '' && !amountValid && (
        <p className="field-note error" role="alert">{t('invalidAmount')}</p>
      )}

      {type === 'expense' && (
        <label className="field">
          <span className="label">{t('category')}</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c, t)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span className="label">{t('note')}</span>
        <input
          type="text"
          autoComplete="off"
          aria-describedby="note-hint"
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <p className="sub note-hint" id="note-hint">
        {t('noteHint')}
      </p>

      <p className="label">{t('repeats')}</p>
      <div className="pill-group wrap">
        {schedules.map((s) => (
          <button
            key={s}
            type="button"
            className={schedule === s ? 'pill active' : 'pill'}
            aria-pressed={schedule === s}
            onClick={() => setSchedule(s)}
          >
            {t(scheduleKey(s, quincenaSchedule))}
          </button>
        ))}
      </div>

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
        <button type="button" className="btn secondary" disabled={saving} onClick={onDone}>
          {t('cancel')}
        </button>
        {item && (
          <button
            type="button"
            className="btn danger"
            disabled={saving}
            onClick={handleDelete}
          >
            {t('delete')}
          </button>
        )}
      </div>
    </div>
  )
}

export default function RecurringScreen() {
  const { t } = useSettings()
  const { recurring } = useTransactions()
  // null, 'new' or the id of the item being edited
  const [editing, setEditing] = useState(null)

  return (
    <>
      <SubHeader to="/settings" backLabel={t('settings')} title={t('recurring')} />
      <p className="sub">{t('recurringHint')}</p>

      <div className="narrow">
        {recurring.length === 0 ? (
          <EmptyState card actions={false} icon="repeat" text={t('noRecurring')} />
        ) : (
          <section className="card">
            <ul className="list">
              {recurring.map((item) => (
                <li key={item.id}>
                  <RecurringRow
                    item={item}
                    expanded={editing === item.id}
                    onClick={() => setEditing(editing === item.id ? null : item.id)}
                  />
                  {editing === item.id && (
                    <RecurringEditor
                      key={item.id}
                      item={item}
                      onDone={() => setEditing(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {editing !== 'new' && (
          <button type="button" className="btn" onClick={() => setEditing('new')}>
            {t('addRecurring')}
          </button>
        )}

        {editing === 'new' && (
          <section className="card">
            <RecurringEditor
              key="new"
              item={null}
              onDone={() => setEditing(null)}
            />
          </section>
        )}
      </div>
    </>
  )
}
