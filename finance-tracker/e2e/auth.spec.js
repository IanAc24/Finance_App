import { test, expect } from './support/fixtures.js'
import { account, email, otherPassword } from './support/accounts.js'
import {
  T,
  expectInApp,
  expectNoAppData,
  expectSignInScreen,
  fillSignIn,
  fillSignUp,
  formMessage,
  getTotals,
  open,
  passConsentAndWelcome,
  signIn,
  signOut,
  signUp,
} from './support/app.js'

// Authentication and account tests. 15 accounts, see support/accounts.js for
// what each one is for. Firebase is the in-test fake (support/fakeAuth.js).

const EN = {
  wrong: 'The email or password is not correct.',
  invalidEmail: 'Enter a valid email, like name@example.com.',
  short: 'The password must have at least 8 characters.',
  mismatch: 'The passwords do not match.',
  inUse: 'There is already an account with that email.',
  resetSent: 'If the email is registered, we sent you a link.',
  required: 'Enter your password.',
}
const ES = {
  wrong: 'El correo o la contraseña no son correctos.',
  invalidEmail: 'Escribe un correo válido, como nombre@ejemplo.com.',
  short: 'La contraseña debe tener al menos 8 caracteres.',
  mismatch: 'Las contraseñas no coinciden.',
  inUse: 'Ya hay una cuenta con ese correo.',
}

const fieldError = (page) => page.locator('.field-note.error')

test.describe('registration', () => {
  test('1 pruebacorreo1: successful registration lands in the app', async ({ page, fake }) => {
    const a = account(1)
    await open(page, '/registro')
    await fillSignUp(page, a.email, a.password)
    await passConsentAndWelcome(page)
    expect(fake.hasUser(a.email)).toBe(true)
    await expect(page).toHaveURL(/localhost:5300\/$/)
    await expectInApp(page)
    expect(fake.count('accounts:signUp')).toBe(1)
  })

  test('1 pruebacorreo1: a double tap on "Create account" sends one request', async ({ page, fake }) => {
    const a = account(1)
    await open(page, '/registro')
    await page.getByLabel(T.email).fill(a.email)
    await page.getByLabel(T.password, { exact: true }).fill(a.password)
    await page.getByLabel(T.confirm).fill(a.password)
    await page.getByRole('button', { name: T.createAccount }).dblclick()
    await passConsentAndWelcome(page)
    expect(fake.count('accounts:signUp')).toBe(1)
  })

  test('5 pruebacorreo5: duplicate registration is refused with a clear message', async ({ page, fake }) => {
    const a = account(5)
    fake.addUser(a.email, a.password)
    await signUp(page, a.email, a.password)
    await expect(formMessage(page)).toHaveText(EN.inUse)
    await expect(page).toHaveURL(/\/registro/)
    await expectNoAppData(page)

    // the same address in capitals is the same account
    await page.getByLabel(T.email).fill(a.email.toUpperCase())
    await page.getByRole('button', { name: T.createAccount }).click()
    await expect(formMessage(page)).toHaveText(EN.inUse)
    expect(fake.users.size).toBe(1)
  })

  test('6 pruebacorreo6: weak password and mismatch are caught on the device, nothing is sent', async ({ page, fake }) => {
    const a = account(6)
    await open(page, '/registro')
    await fillSignUp(page, a.email, 'Ab1!xyz', 'Ab1!xyz') // 7 characters
    await expect(fieldError(page)).toHaveText([EN.short])
    await fillSignUp(page, a.email, a.password, otherPassword(6))
    await expect(fieldError(page)).toHaveText([EN.mismatch])
    await page.getByLabel(T.password, { exact: true }).fill('')
    await page.getByLabel(T.confirm).fill('')
    await page.getByRole('button', { name: T.createAccount }).click()
    await expect(fieldError(page)).toHaveText([EN.short])
    expect(fake.count('accounts:signUp')).toBe(0)
    expect(fake.users.size).toBe(0)
  })

  test('6 pruebacorreo6: a server-side WEAK_PASSWORD gets the password message', async ({ page, fake }) => {
    const a = account(6)
    fake.force('accounts:signUp', 'WEAK_PASSWORD : Password should be at least 6 characters', {
      times: 1,
    })
    await signUp(page, a.email, a.password)
    await expect(formMessage(page)).toHaveText(EN.short)
    await expectNoAppData(page)
  })

  test('4 pruebacorreo4: invalid email format is caught on the device (sign-up and sign-in)', async ({ page, fake }) => {
    const a = account(4)
    for (const bad of ['sin-arroba', 'a@b', 'a b@c.com', '@c.com', 'a@.com']) {
      await open(page, '/registro')
      await fillSignUp(page, bad, a.password)
      await expect(fieldError(page), `sign-up with "${bad}"`).toHaveText([EN.invalidEmail])
      await open(page, '/login')
      await fillSignIn(page, bad, a.password)
      await expect(fieldError(page), `sign-in with "${bad}"`).toHaveText([EN.invalidEmail])
    }
    expect(fake.requests).toHaveLength(0)
  })

  test('4 pruebacorreo4: an address the device accepts but the server rejects shows the same message', async ({ page, fake }) => {
    const a = account(4)
    // "x@y.z" passes the form check; the server wants a 2+ letter ending
    await signUp(page, 'x@y.z', a.password)
    await expect(formMessage(page)).toHaveText(EN.invalidEmail)
    expect(fake.count('accounts:signUp')).toBe(1)
    await signIn(page, 'x@y.z', a.password)
    await expect(formMessage(page)).toHaveText(EN.invalidEmail)
    await expectNoAppData(page)
  })
})

test.describe('sign in and sign out', () => {
  test('2 pruebacorreo2: login, then logout, then login again without repeating the welcome', async ({ page, fake }) => {
    const a = account(2)
    fake.addUser(a.email, a.password)
    await signIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
    await expectInApp(page)
    const totals = await getTotals(page)

    await signOut(page)
    await expectSignInScreen(page)
    await expectNoAppData(page)

    await signIn(page, a.email, a.password)
    await expectInApp(page) // consent and welcome are remembered on this device
    expect(await getTotals(page)).toEqual(totals)
  })

  test('3 pruebacorreo3: wrong password and unknown email give the same message', async ({ page, fake }) => {
    const a = account(3)
    fake.addUser(a.email, a.password)

    await signIn(page, a.email, otherPassword(3))
    await expect(formMessage(page)).toHaveText(EN.wrong)
    const forExisting = await formMessage(page).innerText()
    await expect(page).toHaveURL(/\/login/)
    await expectNoAppData(page)

    await fillSignIn(page, email(99), a.password)
    await expect(formMessage(page)).toHaveText(EN.wrong)
    expect(await formMessage(page).innerText()).toBe(forExisting)

    // the right password still works afterwards
    await fillSignIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
  })

  test('3 pruebacorreo3: an empty password is asked for on the device', async ({ page, fake }) => {
    const a = account(3)
    await open(page, '/login')
    await page.getByLabel(T.email).fill(a.email)
    await page.getByRole('button', { name: T.signIn }).click()
    await expect(fieldError(page)).toHaveText([EN.required])
    expect(fake.requests).toHaveLength(0)
  })

  test('14 pruebacorreo14: signing out from Settings, then Back, shows no data', async ({ page, fake }) => {
    const a = account(14)
    fake.addUser(a.email, a.password)
    await signIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
    await signOut(page) // goes through Settings
    await expectSignInScreen(page)

    await page.goBack()
    await expectSignInScreen(page)
    await expectNoAppData(page)

    await open(page, '/history')
    await expectSignInScreen(page)
    await expectNoAppData(page)
  })
})

test.describe('session', () => {
  test('7 pruebacorreo7: the session survives reloads, on any screen', async ({ page, fake }) => {
    const a = account(7)
    await signUp(page, a.email, a.password)
    await passConsentAndWelcome(page)

    await page.reload()
    await expectInApp(page)
    await expect(page).toHaveURL(/localhost:5300\/$/)

    await open(page, '/history')
    await page.reload()
    await expect(page).toHaveURL(/\/history$/)
    await expectNoSignInForm(page)
    expect(fake.count('accounts:signInWithPassword')).toBe(0) // no second sign-in needed
  })

  test('7 pruebacorreo7: a signed-in person who opens /login or /registro goes back into the app', async ({ page, fake }) => {
    const a = account(7)
    fake.addUser(a.email, a.password)
    await signIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
    for (const path of ['/login', '/registro']) {
      await open(page, path)
      await expectInApp(page)
      await expect(page).toHaveURL(/localhost:5300\/$/)
    }
  })

  test('8 pruebacorreo8: an expired session (token refresh says TOKEN_EXPIRED) returns to sign-in', async ({ page, fake }) => {
    const a = account(8)
    fake.addUser(a.email, a.password)
    fake.expiresIn = 1 // tokens that need a refresh at once
    await signIn(page, a.email, a.password)
    await passConsentAndWelcome(page)

    fake.revokeRefreshTokens()
    fake.force('token', 'TOKEN_EXPIRED')
    await page.reload()
    await expectSignInScreen(page)
    await expectNoAppData(page)
    expect(fake.count('token')).toBeGreaterThan(0)

    // not stuck: signing in again works
    fake.clearForced('token')
    fake.expiresIn = 3600
    await fillSignIn(page, a.email, a.password)
    await expectInApp(page)
  })

  test('9 pruebacorreo9: an account deleted on the server is signed out on reload', async ({ page, fake }) => {
    const a = account(9)
    fake.addUser(a.email, a.password)
    await signIn(page, a.email, a.password)
    await passConsentAndWelcome(page)

    fake.deleteUser(a.email) // lookup now answers USER_NOT_FOUND
    await page.reload()
    await expectSignInScreen(page)
    await expectNoAppData(page)
  })

  test('9 pruebacorreo9: an account disabled on the server is signed out on reload', async ({ page, fake }) => {
    const a = account(9)
    fake.addUser(a.email, a.password)
    await signIn(page, a.email, a.password)
    await passConsentAndWelcome(page)

    fake.disableUser(a.email)
    await page.reload()
    await expectSignInScreen(page)
    await expectNoAppData(page)

    // and a disabled account cannot sign in: the same message as a wrong password
    await fillSignIn(page, a.email, a.password)
    await expect(formMessage(page)).toHaveText(EN.wrong)
  })

  test('9 pruebacorreo9: when lookup fails with a server error the app does not show data or crash', async ({ page, fake }) => {
    const a = account(9)
    fake.addUser(a.email, a.password)
    await signIn(page, a.email, a.password)
    await passConsentAndWelcome(page)

    fake.force('accounts:lookup', 'INTERNAL_ERROR', { status: 500 })
    await page.reload()
    // either the saved session is kept (offline-friendly) or it is dropped;
    // what must never happen is a blank/crashed page or a stuck "Checking"
    await expect(
      page.getByLabel(T.email).or(page.getByRole('heading', { level: 1 })),
    ).toBeVisible()
    await expect(page.getByText(/Checking your session|Revisando tu sesión/)).toHaveCount(0)
  })
})

test.describe('password reset', () => {
  test('10 pruebacorreo10: asking for a link shows the message and sends the email', async ({ page, fake }) => {
    const a = account(10)
    fake.addUser(a.email, a.password)
    await open(page, '/recuperar')
    await page.getByLabel(T.email).fill(a.email)
    await page.getByRole('button', { name: /^(Send link|Enviar enlace)$/ }).click()
    await expect(formMessage(page)).toHaveText(EN.resetSent)
    expect(fake.sentResetEmails).toEqual([a.email.toLowerCase()])
  })

  test('10 pruebacorreo10: a badly written email is caught on the device', async ({ page, fake }) => {
    await open(page, '/recuperar')
    await page.getByLabel(T.email).fill('no-es-correo')
    await page.getByRole('button', { name: /^(Send link|Enviar enlace)$/ }).click()
    await expect(fieldError(page)).toHaveText([EN.invalidEmail])
    expect(fake.requests).toHaveLength(0)
  })

  for (const mode of ['protected', 'legacy']) {
    test(`11 pruebacorreo11: existing and unknown emails look the same (server mode "${mode}")`, async ({ page, fake }) => {
      const known = account(10)
      const unknown = account(11)
      fake.addUser(known.email, known.password)
      fake.resetMode = mode // "legacy": the server itself says EMAIL_NOT_FOUND

      const ask = async (address) => {
        await open(page, '/recuperar')
        await page.getByLabel(T.email).fill(address)
        await page.getByRole('button', { name: /^(Send link|Enviar enlace)$/ }).click()
        await expect(formMessage(page)).toBeVisible()
        return {
          text: await formMessage(page).innerText(),
          role: await formMessage(page).getAttribute('role'),
          fieldErrors: await fieldError(page).count(),
        }
      }
      const forKnown = await ask(known.email)
      const forUnknown = await ask(unknown.email)
      expect(forUnknown).toEqual(forKnown)
      expect(forUnknown.text).toBe(EN.resetSent)
      expect(fake.hasUser(unknown.email)).toBe(false)
    })
  }

  test('11 pruebacorreo11: a server outage is reported, not hidden behind "link sent"', async ({ page, fake }) => {
    const a = account(11)
    fake.force('accounts:sendOobCode', 'TOO_MANY_ATTEMPTS_TRY_LATER')
    await open(page, '/recuperar')
    await page.getByLabel(T.email).fill(a.email)
    await page.getByRole('button', { name: /^(Send link|Enviar enlace)$/ }).click()
    await expect(formMessage(page)).toHaveText(/Too many attempts/)
  })
})

test.describe('protected screens while logged out', () => {
  const paths = [
    '/',
    '/add',
    '/add?type=expense',
    '/history',
    '/settings',
    '/report',
    '/stats',
    '/savings',
    '/settings/categories',
    '/settings/budgets',
    '/settings/recurring',
    '/edit/1',
    '/legal/privacy',
    '/no-such-page',
  ]

  test('12 pruebacorreo12: every route sends a logged-out visitor to sign-in and shows no data', async ({ page, fake }) => {
    const a = account(12)
    fake.addUser(a.email, a.password) // an account exists, but nobody is signed in
    for (const path of paths) {
      await open(page, path)
      await expectSignInScreen(page)
      await expectNoAppData(page)
    }
  })

  test('12 pruebacorreo12: navigating inside the app with no session cannot open a screen', async ({ page }) => {
    await open(page, '/login')
    for (const path of ['/history', '/settings', '/report']) {
      await page.evaluate((to) => {
        window.history.pushState({}, '', to)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, path)
      await expectSignInScreen(page)
      await expectNoAppData(page)
    }
  })

  test('15 pruebacorreo15: after signing in the person lands on the page that was asked for', async ({ page, fake }) => {
    const a = account(15)
    fake.addUser(a.email, a.password)
    // first run: consent and welcome (the welcome always ends on Home, so
    // the deep link is only checked on a later sign-in)
    await signIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
    await signOut(page)
    await expectSignInScreen(page)

    await open(page, '/history')
    await expectSignInScreen(page)
    await fillSignIn(page, a.email, a.password)
    await expect(page).toHaveURL(/\/history$/)
    await expectInApp(page)
  })

  test('15 pruebacorreo15: the page asked for is kept through the first-run welcome', async ({ page, fake }) => {
    test.fail(true, 'Welcome ends with navigate("/"): a first-time deep link is dropped (low severity)')
    const a = account(15)
    fake.addUser(a.email, a.password)
    await open(page, '/history')
    await fillSignIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
    await expect(page).toHaveURL(/\/history$/)
  })

  test('15 pruebacorreo15: /login with a foreign redirect in the URL does not leave the app', async ({ page, fake }) => {
    const a = account(15)
    fake.addUser(a.email, a.password)
    await open(page, '/login?next=https://evil.example/&redirect=//evil.example')
    await fillSignIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
    expect(new URL(page.url()).hostname).toBe('localhost')
  })
})

test.describe('Spanish interface', () => {
  test.use({ locale: 'es-CR' })

  test('13 pruebacorreo13: sign up, errors and sign in speak Spanish', async ({ page }) => {
    const a = account(13)
    await open(page, '/registro')
    await expect(page.getByRole('heading', { name: 'Crear una cuenta' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CR')

    await fillSignUp(page, 'mal-correo', a.password)
    await expect(fieldError(page)).toHaveText([ES.invalidEmail])
    await fillSignUp(page, a.email, 'corta1!', 'corta1!')
    await expect(fieldError(page)).toHaveText([ES.short])
    await fillSignUp(page, a.email, a.password, otherPassword(13))
    await expect(fieldError(page)).toHaveText([ES.mismatch])

    await fillSignUp(page, a.email, a.password)
    await passConsentAndWelcome(page)
    await signOut(page)
    await expectSignInScreen(page)

    await fillSignIn(page, a.email, otherPassword(13))
    await expect(formMessage(page)).toHaveText(ES.wrong)

    await open(page, '/registro')
    await fillSignUp(page, a.email, a.password)
    await expect(formMessage(page)).toHaveText(ES.inUse)
  })
})

test.describe('smoke: no traffic leaves the machine', () => {
  test('only the local app and the faked Google auth hosts are used, and Firestore is never called', async ({ page, fake }) => {
    const a = account(1)
    await signUp(page, a.email, a.password)
    await passConsentAndWelcome(page)
    for (const link of [/^(History|Historial)$/, /^(Settings|Ajustes)$/]) {
      await page.getByRole('link', { name: link }).filter({ visible: true }).first().click()
    }
    await page.reload()
    await signOut(page)

    const allowed = new Set([
      'localhost',
      'identitytoolkit.googleapis.com',
      'securetoken.googleapis.com',
    ])
    const outside = [...fake.hosts].filter((h) => !allowed.has(h))
    expect(outside, 'hosts contacted').toEqual([])
    expect(fake.escaped).toEqual([])
    expect(fake.firestore).toEqual([])
  })
})

async function expectNoSignInForm(page) {
  await expect(page.getByLabel(T.email)).toHaveCount(0)
}
