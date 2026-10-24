import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../context/AuthContext'
import { DialogContext } from '../../context/DialogContext'
import { SettingsContext } from '../../context/SettingsContext'
import AccountBar from './AccountBar'

function render(user) {
  return renderToString(
    h(
      SettingsContext.Provider,
      { value: { lang: 'es', t: (key) => `[${key}]` } },
      h(
        DialogContext.Provider,
        { value: { alert: vi.fn(), confirm: vi.fn() } },
        h(
          AuthContext.Provider,
          { value: { status: 'authenticated', user, signOut: vi.fn() } },
          h(AccountBar),
        ),
      ),
    ),
  )
}

describe('AccountBar (consent and welcome screens)', () => {
  it('shows the account and a sign out button, so nobody is stuck there', () => {
    const html = render({ email: 'ana@ejemplo.com' })
    expect(html).toContain('ana@ejemplo.com')
    expect(html).toContain('[signOut]')
    expect(html).toContain('type="button"')
  })
})
