import { useRef, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import { runOnce } from '../../lib/authForm'

// The account and a way out, for the screens that replace the whole app
// (consent, welcome) and so have no menu to reach Settings. Signing out
// keeps the local data.
export default function AccountBar() {
  const { t } = useSettings()
  const { alert } = useDialog()
  const { user, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  const handleSignOut = () =>
    runOnce(lock, async () => {
      setBusy(true)
      try {
        await signOut()
      } catch (error) {
        console.warn('auth', error?.code ?? 'unknown')
        setBusy(false)
        await alert(t('authUnknown'))
      }
    })

  return (
    <div className="account-bar">
      <span className="account-bar-email">{user?.email}</span>
      <button
        type="button"
        className="btn secondary account-bar-btn"
        disabled={busy}
        onClick={handleSignOut}
      >
        {t('signOut')}
      </button>
    </div>
  )
}
