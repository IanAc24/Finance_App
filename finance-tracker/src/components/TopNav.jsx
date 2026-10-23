import { NavLink } from 'react-router-dom'
import { useSettings } from '../context/useSettings'

export default function TopNav() {
  const { t } = useSettings()

  return (
    <nav className="top-nav" aria-label={t('mainNav')}>
      <NavLink to="/" end>
        {t('home')}
      </NavLink>
      <NavLink to="/add">{t('add')}</NavLink>
      <NavLink to="/stats">{t('statistics')}</NavLink>
      <NavLink to="/history">{t('history')}</NavLink>
    </nav>
  )
}
