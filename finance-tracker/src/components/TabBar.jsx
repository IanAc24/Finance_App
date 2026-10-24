import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../context/useSettings'
import { Icon } from './CategoryIcon'

// The bottom tab bar of phones (the CSS hides it from 900px, where the top bar
// has the same links): Inicio, Historial, a round "+" in the middle,
// Ahorros and Estadísticas. Settings is the gear of the top bar and Income is
// reached from Home and from History. The tab of the screen on view is teal,
// in bold and carries aria-current.
export default function TabBar() {
  const { t } = useSettings()
  const { pathname } = useLocation()
  const items = [
    ['/', 'house', t('home'), pathname === '/'],
    ['/history', 'history', t('history'), pathname === '/history'],
    ['/add?type=expense', 'plus', t('add'), pathname === '/add'],
    ['/savings', 'piggyBank', t('savings'), pathname.startsWith('/savings')],
    ['/stats', 'chart', t('statistics'), pathname === '/stats'],
  ]

  return (
    <nav className="tab-bar" aria-label={t('mainNav')}>
      {items.map(([to, icon, label, active], index) => (
        <Link
          key={to}
          to={to}
          className={
            (index === 2 ? 'tab is-add' : 'tab') + (active ? ' is-active' : '')
          }
          aria-current={active ? 'page' : undefined}
        >
          <span className="tab-icon">
            <Icon name={icon} size={index === 2 ? 24 : 22} />
          </span>
          <span className="tab-label">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
