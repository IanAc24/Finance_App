import { LEGAL_DOCS } from './legal'

// The translation key of the name of a screen, for the title of the browser
// tab and the history ('/history' -> 'history'). null when the path is not a
// screen of the app.
export function pageTitleKey(pathname) {
  if (pathname === '/') return 'home'
  if (pathname === '/add') return 'add'
  if (pathname.startsWith('/edit/')) return 'editTransaction'
  if (pathname === '/stats') return 'statistics'
  if (pathname === '/history') return 'history'
  if (pathname === '/settings') return 'settings'
  if (pathname === '/settings/categories') return 'categories'
  if (pathname === '/settings/budgets') return 'budgets'
  if (pathname === '/settings/recurring') return 'recurring'
  if (pathname === '/savings') return 'savings'
  if (pathname.startsWith('/savings/recap/')) return 'svRecapOpen'
  if (pathname === '/income') return 'income'
  if (pathname === '/report') return 'report'
  if (pathname.startsWith('/legal/')) {
    const doc = LEGAL_DOCS.find((d) => `/legal/${d.id}` === pathname)
    return doc ? doc.titleKey : 'settings'
  }
  return null
}

// Screens that belong to Settings: the gear is the active tab on all of them
// (Savings is a tab of its own now)
export function isSettingsPath(pathname) {
  return (
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname.startsWith('/legal/')
  )
}

// The text of the browser tab: 'Historial · I AM POOR FOR NOW', or just the
// app name when there is no screen name
export function tabTitle(screen, appName) {
  return screen ? `${screen} · ${appName}` : appName
}
