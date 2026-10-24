import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useConsent } from '../context/useConsent'
import { useSettings } from '../context/useSettings'
import { useTransactions } from '../context/useTransactions'
import { hasCurrentConsent } from '../lib/legal'
import { pageTitleKey } from '../lib/pageTitle'

// Keeps the title of the browser tab in step with the screen:
// 'Historial · I AM POOR FOR NOW'. Before the app is open (consent, welcome)
// it is just the name of the app. Renders nothing.
export default function DocumentTitle() {
  const { t } = useSettings()
  const { pathname } = useLocation()
  const { consent } = useConsent()
  const { showOnboarding } = useTransactions()

  const appName = `${t('titleMain')} ${t('titleAccent')}`
  const key =
    hasCurrentConsent(consent) && !showOnboarding ? pageTitleKey(pathname) : null
  const title = key ? `${t(key)} · ${appName}` : appName

  useEffect(() => {
    document.title = title
  }, [title])

  return null
}
