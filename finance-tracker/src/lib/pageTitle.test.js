import { describe, expect, it } from 'vitest'
import { isSettingsPath, pageTitleKey, tabTitle } from './pageTitle'

describe('pageTitleKey', () => {
  it('names every screen of the app', () => {
    expect(pageTitleKey('/')).toBe('home')
    expect(pageTitleKey('/add')).toBe('add')
    expect(pageTitleKey('/edit/12')).toBe('editTransaction')
    expect(pageTitleKey('/stats')).toBe('statistics')
    expect(pageTitleKey('/history')).toBe('history')
    expect(pageTitleKey('/settings')).toBe('settings')
    expect(pageTitleKey('/settings/categories')).toBe('categories')
    expect(pageTitleKey('/settings/budgets')).toBe('budgets')
    expect(pageTitleKey('/settings/recurring')).toBe('recurring')
    expect(pageTitleKey('/savings')).toBe('savings')
    expect(pageTitleKey('/savings/recap/2026')).toBe('svRecapOpen')
    expect(pageTitleKey('/income')).toBe('income')
    expect(pageTitleKey('/report')).toBe('report')
  })

  it('names each legal document', () => {
    expect(pageTitleKey('/legal/privacy')).toBe('legalPrivacy')
    expect(pageTitleKey('/legal/cookies')).toBe('legalCookies')
  })

  it('has no title for an unknown path', () => {
    expect(pageTitleKey('/nope')).toBeNull()
  })
})

describe('isSettingsPath', () => {
  it('is true for Settings and the screens opened from it', () => {
    for (const path of ['/settings', '/settings/budgets', '/legal/terms']) {
      expect(isSettingsPath(path)).toBe(true)
    }
  })

  it('is false for the main tabs', () => {
    for (const path of ['/', '/add', '/stats', '/history', '/edit/3', '/income', '/savings']) {
      expect(isSettingsPath(path)).toBe(false)
    }
  })
})

describe('tabTitle', () => {
  it('puts the screen first and the app name after', () => {
    expect(tabTitle('Entra a tu cuenta', 'I AM POOR FOR NOW')).toBe('Entra a tu cuenta · I AM POOR FOR NOW')
  })

  it('is just the app name without a screen', () => {
    expect(tabTitle('', 'I AM POOR FOR NOW')).toBe('I AM POOR FOR NOW')
    expect(tabTitle(null, 'I AM POOR FOR NOW')).toBe('I AM POOR FOR NOW')
  })
})
