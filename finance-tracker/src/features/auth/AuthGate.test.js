import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../context/AuthContext'
import { SettingsContext } from '../../context/SettingsContext'

// <Navigate> only moves inside an effect, which a server render does not
// run; this stand-in shows where it would go and what it would carry
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    Navigate: ({ to, state }) =>
      h('a', { 'data-to': to, 'data-from': state ? JSON.stringify(state.from) : '' }),
  }
})

const { default: AuthGate, PublicOnly } = await import('./AuthGate')
const { default: LoginScreen } = await import('./LoginScreen')
const { default: ResetPasswordScreen } = await import('./ResetPasswordScreen')
const { default: SignUpScreen } = await import('./SignUpScreen')

const settings = { lang: 'es', t: (key) => `[${key}]` }

function render(status, element, { path = '/', state } = {}) {
  const auth = {
    status,
    user: status === 'authenticated' ? { email: 'ana@ejemplo.com' } : null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
  }
  return renderToString(
    h(
      SettingsContext.Provider,
      { value: settings },
      h(
        AuthContext.Provider,
        { value: auth },
        h(
          MemoryRouter,
          { initialEntries: [{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }] },
          h(Routes, null, h(Route, { path: '*', element })),
        ),
      ),
    ),
  )
}

const app = h('p', null, 'APP')
const decode = (html) => html.replace(/&quot;/g, '"')

describe('AuthGate', () => {
  it('shows only the loading screen while the session is checked', () => {
    const html = render('loading', h(AuthGate, null, app))
    expect(html).toContain('[authChecking]')
    expect(html).not.toContain('APP')
    expect(html).not.toContain('data-to')
  })

  it('sends to /login without a session, keeping the page asked for', () => {
    const html = decode(render('unauthenticated', h(AuthGate, null, app), { path: '/history?q=pan' }))
    expect(html).not.toContain('APP')
    expect(html).toContain('data-to="/login"')
    expect(html).toContain('"pathname":"/history"')
    expect(html).toContain('"search":"?q=pan"')
  })

  it('shows the app (and only then mounts the data) with a session', () => {
    const html = render('authenticated', h(AuthGate, null, app))
    expect(html).toContain('APP')
    expect(html).not.toContain('data-to')
  })
})

describe('PublicOnly (/login)', () => {
  const login = h('p', null, 'LOGIN')

  it('shows the form without a session', () => {
    expect(render('unauthenticated', h(PublicOnly, null, login))).toContain('LOGIN')
  })

  it('waits while the session is checked, so the form does not flash', () => {
    const html = render('loading', h(PublicOnly, null, login))
    expect(html).toContain('[authChecking]')
    expect(html).not.toContain('LOGIN')
  })

  it('with a session goes back to the saved page, or to the start', () => {
    const back = render('authenticated', h(PublicOnly, null, login), {
      path: '/login',
      state: { from: { pathname: '/stats', search: '', hash: '' } },
    })
    expect(back).toContain('data-to="/stats"')
    expect(render('authenticated', h(PublicOnly, null, login))).toContain('data-to="/"')
    const outside = render('authenticated', h(PublicOnly, null, login), {
      state: { from: { pathname: '//otro.com' } },
    })
    expect(outside).toContain('data-to="/"')
  })
})

describe('LoginScreen', () => {
  const html = render('unauthenticated', h(LoginScreen))

  it('has visible labels tied to the inputs', () => {
    expect(html).toContain('for="login-email"')
    expect(html).toContain('for="login-password"')
    expect(html).toContain('[authEmail]')
    expect(html).toContain('[authPassword]')
  })

  it('uses the right input types and autocomplete', () => {
    expect(html).toMatch(/id="login-email"[^>]*type="email"|type="email"[^>]*id="login-email"/)
    expect(html).toContain('autoComplete="email"')
    expect(html).toContain('autoComplete="current-password"')
    expect(html).toContain('type="password"')
  })

  it('has the show-password button and its own validation', () => {
    expect(html).toContain('[authShowPassword]')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('noValidate')
    expect(html).toContain('[authSignIn]')
  })

  it('links to password recovery', () => {
    expect(html).toContain('href="/recuperar"')
    expect(html).toContain('[authForgot]')
  })
})

describe('ResetPasswordScreen', () => {
  const html = render('unauthenticated', h(ResetPasswordScreen))

  it('asks only for the email, with its label and autocomplete', () => {
    expect(html).toContain('for="reset-email"')
    expect(html).toContain('type="email"')
    expect(html).toContain('autoComplete="email"')
    expect(html).not.toContain('type="password"')
    expect(html).toContain('[authResetSend]')
  })

  it('links back to sign in', () => {
    expect(html).toContain('href="/login"')
  })
})

describe('sign-up switch (VITE_ALLOW_SIGNUP)', () => {
  it('shows the "create an account" link only when it is "1"', () => {
    vi.stubEnv('VITE_ALLOW_SIGNUP', '0')
    const off = render('unauthenticated', h(LoginScreen))
    expect(off).not.toContain('href="/registro"')
    vi.stubEnv('VITE_ALLOW_SIGNUP', '1')
    const on = render('unauthenticated', h(LoginScreen))
    expect(on).toContain('href="/registro"')
    vi.unstubAllEnvs()
  })

  it('asks for the password twice, as a new password, with the 8 character hint', () => {
    const html = render('unauthenticated', h(SignUpScreen))
    expect(html).toContain('for="signup-email"')
    expect(html).toContain('for="signup-password"')
    expect(html).toContain('for="signup-confirm"')
    expect(html.match(/autoComplete="new-password"/g)).toHaveLength(2)
    expect(html).toContain('[authPasswordHint]')
    expect(html).toContain('aria-describedby="signup-password-hint"')
    expect(html).toContain('href="/login"')
  })
})
