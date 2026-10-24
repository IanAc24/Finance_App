import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../context/useSettings'
import { isSettingsPath } from '../lib/pageTitle'
import { Icon } from './CategoryIcon'
import Logo from './Logo'
import TopNav from './TopNav'

// The bar at the top. On phones it is the brand and the gear (the bottom
// TabBar has the links); from 900px it also has the tabs.
export default function AppBar() {
  const { t } = useSettings()
  const { pathname } = useLocation()
  // the gear is the active tab on Settings and on the screens opened from it
  const inSettings = isSettingsPath(pathname)

  return (
    <header className="app-bar">
      <Link
        className="brand"
        to="/"
        aria-label={`${t('titleMain')} ${t('titleAccent')} – ${t('homeLink')}`}
        title={t('homeLink')}
      >
        <Logo />
        <span className="brand-name">
          {t('titleMain')} <span className="title-accent">{t('titleAccent')}</span>
        </span>
      </Link>
      <TopNav />
      <Link
        className={inSettings ? 'icon-link active' : 'icon-link'}
        aria-current={inSettings ? 'page' : undefined}
        to="/settings"
        aria-label={t('settings')}
        title={t('settings')}
      >
        <Icon name="settings" size={20} />
      </Link>
    </header>
  )
}
