import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../context/useSettings'
import { Icon } from './CategoryIcon'

// Round "+" button to add an expense, fixed at the bottom right on phones
// (the CSS hides it from 900px, where Home has its own buttons). It is not
// shown on the add and edit screens, which have their own save bar. While a
// dialog is open the CSS hides it too.
export default function AddFab() {
  const { t } = useSettings()
  const { pathname } = useLocation()

  if (pathname === '/add' || pathname.startsWith('/edit/')) return null

  return (
    <Link className="add-fab" to="/add?type=expense" aria-label={t('addExpense')}>
      <Icon name="plus" size={28} />
    </Link>
  )
}
