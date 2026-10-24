import { useEffect, useState } from 'react'
import { AuthContext } from './AuthContext'
import { useSettings } from './useSettings'
import StatusScreen from '../components/StatusScreen'
import {
  isFirebaseConfigured,
  resetPassword,
  signIn,
  signOut,
  signUp,
  watchAuth,
} from '../lib/firebase'

const actions = { signIn, signUp, signOut, resetPassword }

// Who is signed in. Firebase keeps the session in the browser, so after a
// reload it is 'loading' for a moment and then 'authenticated' again.
export default function AuthProvider({ children }) {
  const { t } = useSettings()
  const configured = isFirebaseConfigured()
  const [session, setSession] = useState({ status: 'loading', user: null })

  useEffect(() => {
    if (!configured) return undefined
    return watchAuth(
      (user) =>
        setSession({ status: user ? 'authenticated' : 'unauthenticated', user }),
      // if Firebase cannot tell, the person signs in again
      () => setSession({ status: 'unauthenticated', user: null }),
    )
  }, [configured])

  // without the settings nothing can work: say so instead of a blank page
  if (!configured) return <StatusScreen text={t('authConfigMissing')} />

  return (
    <AuthContext.Provider value={{ ...session, ...actions }}>
      {children}
    </AuthContext.Provider>
  )
}
