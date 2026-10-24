import { NavLink } from 'react-router-dom'
import { useSettings } from '../context/useSettings'
import { Icon } from './CategoryIcon'

// The tabs of the top bar (from 900px; phones use the bottom TabBar)
export default function TopNav() {
  const { t } = useSettings()
  const items = [
    ['/', 'house', t('home')],
    ['/add', 'plus', t('add')],
    ['/history', 'history', t('history')],
    ['/income', 'handCoins', t('income')],
    ['/savings', 'piggyBank', t('savings')],
    ['/stats', 'chart', t('statistics')],
  ]

  return (
    <nav className="top-nav" aria-label={t('mainNav')}>
      {items.map(([to, icon, label]) => (
        <NavLink key={to} to={to} end={to === '/'}>
          <Icon name={icon} size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
