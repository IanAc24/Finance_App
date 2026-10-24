import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/CategoryIcon'
import Illustration from '../components/Illustration'
import { ToastContext } from './ToastContext'
import { useSettings } from './useSettings'

// How long a toast stays on screen
const TOAST_MS = 4000

// Short confirmations that fade away on their own ("Gasto guardado"). One
// toast at a time: a new one replaces the one showing. It lives in a polite
// aria-live region, so a screen reader reads it without taking the focus. The
// timer stops while the mouse is over the toast or the focus is inside it.
// Must be inside the router: the action is a link.
//
//   const { show } = useToast()
//   show({ message, action: { label, to: '/add?type=expense' } })
// `kind: 'success'` adds the small check illustration at the start.
export default function ToastProvider({ children }) {
  const { t } = useSettings()
  const [toast, setToast] = useState(null)
  const [paused, setPaused] = useState(false)

  const show = useCallback((options) => {
    setPaused(false)
    setToast({ ...options, id: Date.now() + Math.random() })
  }, [])
  const dismiss = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!toast || paused) return undefined
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, paused])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div
            className="toast"
            key={toast.id}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={(event) => {
              // the focus moving between the toast's own buttons is not leaving
              if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
            }}
          >
            {toast.kind === 'success' ? (
              <Illustration name="check" size={20} className="toast-art" />
            ) : (
              <span className="toast-icon" aria-hidden="true">
                <Icon name="check" size={18} />
              </span>
            )}
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <Link
                className="toast-action"
                to={toast.action.to}
                state={toast.action.state}
                onClick={dismiss}
              >
                {toast.action.label}
              </Link>
            )}
            <button
              type="button"
              className="toast-close"
              aria-label={t('dismiss')}
              onClick={dismiss}
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
