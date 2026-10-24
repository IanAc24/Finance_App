import { useEffect } from 'react'
import Header from '../../Header'
import { useSettings } from '../../context/useSettings'
import { tabTitle } from '../../lib/pageTitle'

// Frame of the sign-in screens: the bar with the logo (no tabs: nothing
// else works yet) and one card with the title and the form
export default function AuthLayout({ title, children }) {
  const { t } = useSettings()
  const tab = tabTitle(title, `${t('titleMain')} ${t('titleAccent')}`)

  // the browser tab names this screen, not the last one of the app (after
  // signing out it still said "Settings")
  useEffect(() => {
    document.title = tab
  }, [tab])

  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="auth-main">
        <section className="card auth-card">
          <h2 className="auth-title">{title}</h2>
          {children}
        </section>
      </main>
    </>
  )
}
