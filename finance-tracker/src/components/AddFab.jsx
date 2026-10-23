import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../context/useSettings'
import { useTransactions } from '../context/useTransactions'
import { isDue, isHandled } from '../lib/recurring'
import { useToday } from '../lib/useToday'
import { Icon } from './CategoryIcon'

// The screens where the button is useful: the ones that list or summarise
// the money. Everywhere else (Settings, Legal, Add, Edit) it only gets in the
// way of the text.
const FAB_PATHS = ['/', '/history', '/stats']

// How far (px) the page must move before the button reacts, so a tiny wobble
// of the finger does not make it blink
const SCROLL_STEP = 8

// Round "+" button to add an expense, fixed at the bottom right on phones
// (the CSS hides it from 900px, where Home has its own buttons). It shows on
// Home, History and Statistics only, and not on the empty Home, which already
// has two big add buttons. It slides away while scrolling down (so it never
// sits on top of what is being read) and comes back when scrolling up or at
// the end of the page. While a dialog is open the CSS hides it too.
export default function AddFab() {
  const { t } = useSettings()
  const { pathname } = useLocation()
  const { transactions, savings, recurring, quincenaSchedule } = useTransactions()
  const today = useToday()
  // the path on which the button was slid away: another path shows it again
  const [hiddenPath, setHiddenPath] = useState(null)
  const hidden = hiddenPath === pathname

  // the same test Home uses for its welcome message (nothing at all yet)
  const homeIsEmpty =
    transactions.length === 0 &&
    savings.length === 0 &&
    !recurring.some(
      (item) =>
        isDue(item, today, quincenaSchedule) ||
        isHandled(item, today, quincenaSchedule),
    )
  const visibleHere =
    FAB_PATHS.includes(pathname) && !(pathname === '/' && homeIsEmpty)

  useEffect(() => {
    if (!visibleHere) return undefined
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 80
      if (atEnd || y < SCROLL_STEP) setHiddenPath(null)
      else if (y - lastY > SCROLL_STEP) setHiddenPath(pathname)
      else if (lastY - y > SCROLL_STEP) setHiddenPath(null)
      else return
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname, visibleHere])

  if (!visibleHere) return null

  return (
    <Link
      className={hidden ? 'add-fab is-hidden' : 'add-fab'}
      to="/add?type=expense"
      aria-label={t('addExpense')}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      <Icon name="plus" size={28} />
    </Link>
  )
}
