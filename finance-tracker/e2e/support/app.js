import { expect } from '@playwright/test'

// Helpers that drive the app through its real UI with accessible locators.
// They accept both languages (English by default, Spanish with
// test.use({ locale: 'es-CR' })), because the app picks its language from
// the browser.

const T = {
  email: /^(Email|Correo)$/,
  password: /^(Password|Contraseña)$/,
  confirm: /^(Repeat the password|Repite la contraseña)$/,
  signIn: /^(Sign in|Entrar)$/,
  signOut: /^(Sign out|Cerrar sesión)$/,
  createAccount: /^(Create account|Crear cuenta)$/i,
  consentCheck: /(I have read and accept|He leído y acepto)/,
  consentAccept: /^(Accept and continue|Aceptar y continuar)$/,
  skipSetup: /^(Skip the setup|Omitir la configuración)$/,
  settings: /^(Settings|Ajustes)$/,
  signInTitle: /(Sign in to your account|Entra a tu cuenta)/,
}
export { T }

// Opens a path of the app and waits for the first screen to settle
export async function open(page, path = '/') {
  await page.goto(path)
}

export function signInHeading(page) {
  return page.getByRole('heading', { name: T.signInTitle })
}

export async function expectSignInScreen(page) {
  await expect(page).toHaveURL(/\/login(\?|$)/)
  await expect(signInHeading(page)).toBeVisible()
  await expect(page.getByLabel(T.email)).toBeVisible()
}

// Nothing of the app (menu, totals, data) is on screen
export async function expectNoAppData(page) {
  await expect(page.locator('.summary-amount')).toHaveCount(0)
  await expect(page.locator('nav.tab-bar')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^(History|Historial)$/ })).toHaveCount(0)
}

export async function acceptConsent(page) {
  await page.getByRole('checkbox', { name: T.consentCheck }).check()
  await page.getByRole('button', { name: T.consentAccept }).click()
}

// The first-use screen: leave it without saving anything
export async function skipWelcome(page) {
  await page.getByRole('button', { name: T.skipSetup }).click()
}

// consent + welcome, in whatever order the app asks for them
export async function passConsentAndWelcome(page) {
  const accept = page.getByRole('button', { name: T.consentAccept })
  const skip = page.getByRole('button', { name: T.skipSetup })
  const home = homeLink(page)
  await expect(accept.or(skip).or(home).first()).toBeVisible()
  if (await accept.isVisible()) await acceptConsent(page)
  await expect(skip.or(home).first()).toBeVisible()
  if (await skip.isVisible()) await skipWelcome(page)
  await expectInApp(page)
}

function homeLink(page) {
  return page.getByRole('link', { name: /^(Home|Inicio)$/ }).first()
}

// The main app (with its navigation) is on screen
export async function expectInApp(page) {
  await expect(page.getByRole('link', { name: T.settings }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export async function fillSignIn(page, email, password) {
  await page.getByLabel(T.email).fill(email)
  await page.getByLabel(T.password, { exact: true }).fill(password)
  await page.getByRole('button', { name: T.signIn }).click()
}

export async function signIn(page, email, password) {
  await open(page, '/login')
  await fillSignIn(page, email, password)
}

export async function fillSignUp(page, email, password, confirm = password) {
  await page.getByLabel(T.email).fill(email)
  await page.getByLabel(T.password, { exact: true }).fill(password)
  await page.getByLabel(T.confirm).fill(confirm)
  await page.getByRole('button', { name: T.createAccount }).click()
}

export async function signUp(page, email, password) {
  await open(page, '/registro')
  await fillSignUp(page, email, password)
}

// Signs out wherever the person is: the bar of the consent/welcome screens
// or the Settings screen
export async function signOut(page) {
  const direct = page.getByRole('button', { name: T.signOut })
  if (!(await direct.isVisible())) {
    await page.getByRole('link', { name: T.settings }).filter({ visible: true }).first().click()
  }
  await page.getByRole('button', { name: T.signOut }).click()
}

// The money figures on Home ("summary-amount"), as text
export async function getTotals(page) {
  return (await page.locator('.summary-amount').allInnerTexts()).map((s) => s.trim())
}

// The text of the alert/status message of a form
export function formMessage(page) {
  return page.locator('.auth-message')
}

// ---------------------------------------------------------------------------
// Helpers added by the workflow / money / edge specs (Agent D). They only
// add behaviour; nothing above was changed.
// ---------------------------------------------------------------------------

// window.print is replaced (the report opens the print dialog by itself) and
// counted in window.__prints. Call before the first page.goto.
export async function stubPrint(context) {
  await context.addInitScript(() => {
    window.__prints = 0
    window.print = () => {
      window.__prints += 1
    }
  })
}

// Sign up with one of the QA accounts and pass consent + welcome
export async function registerAndEnter(page, a) {
  await signUp(page, a.email, a.password)
  await passConsentAndWelcome(page)
}

const NAV = {
  home: /^(Home|Inicio)$/,
  add: /^(Add|Agregar)$/,
  history: /^(History|Historial)$/,
  stats: /^(Statistics|Estadísticas)$/,
  settings: T.settings,
}

// Where each menu link leads, to know when the new screen is there
const NAV_PATH = {
  home: /^\/$/,
  add: /^\/add$/,
  history: /^\/history$/,
  stats: /^\/stats$/,
  settings: /^\/settings$/,
}

// Client-side navigation through the visible menu (top bar on desktop, bottom
// tab bar on phones), so the app is not reloaded. It returns only once the
// address and the screen's title have changed, so the next step never reads
// the previous screen (seen with the real Firebase, where saves are slower).
export async function goTo(page, where) {
  await page.getByRole('link', { name: NAV[where] }).filter({ visible: true }).first().click()
  await page.waitForURL((url) => NAV_PATH[where].test(url.pathname), { timeout: 30_000 })
  if (where === 'history') {
    await expect(page.getByRole('heading', { level: 1, name: /^(History|Historial)$/ })).toBeVisible()
  }
}

// YYYY-MM-DD of "today minus offset days" in the browser's (= this machine's) zone
export function dateStr(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Types an amount with the PHYSICAL keyboard (works when no field has focus)
export async function typeAmountKeys(page, text) {
  for (const ch of text) await page.keyboard.press(ch)
}

// Types an amount with the on-screen keypad (clicks / taps)
export async function typeAmountPad(page, text, { tap = false } = {}) {
  const pad = page.locator('.keypad')
  for (const ch of text) {
    const key = pad.getByRole('button', { name: ch, exact: true })
    if (tap) await key.tap()
    else await key.click()
  }
}

export function addAmountText(page) {
  return page.locator('.add-amount')
}

export function saveButton(page) {
  return page.locator('button.save-key')
}

// Chooses a day of the last week in the date sheet (0 = today)
export async function pickDate(page, daysAgo) {
  await page.getByRole('button', { name: /^(Date|Fecha):/ }).click()
  const sheet = page.locator('dialog.sheet[open]')
  await sheet.locator('.date-strip .date-tile:not(.is-other)').nth(6 - daysAgo).click()
  await sheet.getByRole('button', { name: /^(Done|Listo)$/ }).click()
  await expect(page.locator('dialog.sheet[open]')).toHaveCount(0)
}

// Fills the Add screen and presses Save. Opens the screen from the menu when
// the person is not on it. opts: type ('expense'|'income'), currency, amount,
// category (visible tile name, e.g. 'Food'), custom (name of a new category),
// payment ('Cash'|'Card'|'SINPE'), note, daysAgo, keys (physical keyboard)
export async function addEntry(page, opts) {
  const {
    type = 'expense',
    currency = 'CRC',
    amount,
    category,
    custom,
    payment,
    note,
    daysAgo = 0,
    keys = true,
    save = true,
  } = opts
  if (!/\/add(\?|$)/.test(page.url())) await goTo(page, 'add')
  await expect(page.locator('.keypad')).toBeVisible()
  if (type === 'income') {
    await page.getByRole('group', { name: /^(Type|Tipo)$/ }).getByRole('button', { name: /^(Income|Ingreso)$/ }).click()
  } else {
    await page.getByRole('group', { name: /^(Type|Tipo)$/ }).getByRole('button', { name: /^(Expense|Gasto)$/ }).click()
  }
  await page.locator('.add-toprow .seg').nth(1).getByRole('button', { name: currency, exact: true }).click()
  if (type === 'expense') {
    if (custom !== undefined) {
      await page.locator('.cat-tile').last().click()
      await page.getByPlaceholder(/^(Category name|Nombre de la categoría)$/).fill(custom)
    } else if (category) {
      await page.locator('.cat-tile').filter({ hasText: category }).first().click()
    }
  }
  if (payment) await page.getByRole('button', { name: payment, exact: true }).click()
  if (keys) await typeAmountKeys(page, amount)
  else await typeAmountPad(page, amount)
  if (note !== undefined) await page.getByRole('textbox', { name: /^(Note|Nota)/ }).fill(note)
  if (daysAgo) await pickDate(page, daysAgo)
  if (save) {
    await saveButton(page).click()
    // the app leaves the Add screen only once the save resolved; waiting for
    // that (not just for a toast, which may still be the previous one) keeps
    // the next step from starting while a save is in flight (cloud mode)
    await page.waitForURL((url) => !/^\/(add|edit)(\/|$)/.test(url.pathname), { timeout: 30_000 })
    await expect(page.locator('.toast-message')).toHaveText(
      type === 'income' ? /^(Income saved|Ingreso guardado)$/ : /^(Expense saved|Gasto guardado)$/,
    )
  }
}

// The History list rows of the month on screen as { name, amount }
export async function historyRows(page) {
  return page.locator('.hist-row').evaluateAll((rows) =>
    rows.map((r) => ({
      name: r.querySelector('.hist-row-name')?.textContent?.trim() ?? '',
      meta: r.querySelector('.hist-row-meta')?.textContent?.trim() ?? '',
      amount: r.querySelector('.hist-row-amount')?.textContent?.replace(/\s/g, ' ').trim() ?? '',
    })),
  )
}

// The month summary of History: one entry per currency {label, income, spent}
export async function historySummary(page) {
  return page.locator('.hist-sum p').evaluateAll((ps) =>
    ps.map((p) => {
      const spans = [...p.children].map((c) => c.textContent.replace(/\s/g, ' ').trim())
      return { label: spans[0], figures: spans.slice(1) }
    }),
  )
}

// Home: the "where the money went" rows of one currency: [{name, amount}]
export async function homeCategoryRows(page, code) {
  const heading = page.locator(`#where-${code}`)
  const block = heading.locator('xpath=..')
  const more = block.getByRole('button', { name: /^(Show all|Ver todo|Ver todas)/ })
  if (await more.count()) await more.first().click()
  return block.locator('.cat-list li').evaluateAll((lis) =>
    lis.map((li) => ({
      name: li.querySelector('.tx-name')?.textContent?.trim() ?? '',
      amount: li.querySelector('.cat-amount > span')?.textContent?.trim() ?? '',
    })),
  )
}

// Normalises whitespace (thin / no-break spaces) for comparisons
export function norm(text) {
  return String(text).replace(/[\s\u2009\u00a0\u202f]+/g, ' ').trim()
}
