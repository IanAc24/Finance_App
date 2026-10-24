import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useSettings } from '../../context/useSettings'
import StatusScreen from '../../components/StatusScreen'
import { safeRedirect } from '../../lib/authForm'

// While Firebase checks the saved session nothing else is shown, so the
// sign-in form never flashes for someone who is already signed in
function Checking() {
  const { t } = useSettings()
  return <StatusScreen text={t('authChecking')} busy />
}

// Protected part of the app: without a session it goes to /login and keeps
// the page that was asked for, to come back to it after signing in
export default function AuthGate({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Checking />
  if (status !== 'authenticated') {
    const { pathname, search, hash } = location
    return <Navigate to="/login" replace state={{ from: { pathname, search, hash } }} />
  }
  return children
}

// /login and /registro: with a session they go on into the app
export function PublicOnly({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Checking />
  if (status === 'authenticated') {
    return <Navigate to={safeRedirect(location.state?.from)} replace />
  }
  return children
}
