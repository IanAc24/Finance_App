import { useEffect, useRef } from 'react'
import { useSettings } from '../context/useSettings'
import { Icon } from './CategoryIcon'

// A small bottom sheet (a centred card from 900px) on a native <dialog>: the
// browser traps the focus, Escape closes it and the page behind is inert.
// A click on the dim area closes it too. Used for the date and the extra
// options of Add, and for the month and the filters of History.
export default function Sheet({ open, onClose, title, children }) {
  const { t } = useSettings()
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="sheet-body">
          <div className="sheet-head">
            <h2>{title}</h2>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('dismiss')}
              onClick={onClose}
            >
              <Icon name="x" size={20} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
