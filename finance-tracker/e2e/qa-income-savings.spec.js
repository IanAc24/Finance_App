import { test, expect } from './support/fixtures.js'
import { FakeAuth, installNetwork } from './support/fakeAuth.js'
import { account } from './support/accounts.js'
import {
  addEntry,
  dateStr,
  expectInApp,
  fillSignIn,
  getTotals,
  goTo,
  historySummary,
  norm,
  passConsentAndWelcome,
  registerAndEnter,
  saveButton,
  signOut,
  stubPrint,
  typeAmountKeys,
} from './support/app.js'

// Independent QA of "ingresos y ahorros" (income, savings, goals, recap).
// Fresh account per test. Screenshots: e2e/results/artifacts/qa-*.png

const EN_OR_ES = (en, es) => new RegExp(`^(${en}|${es})$`)
const SHOTS = 'e2e/results/artifacts'
const year = new Date().getFullYear()

// ---- helpers ------------------------------------------------------------------

// every console error and page error, so a test can assert there are none
function watchConsole(page) {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  return errors
}

async function openSavings(page) {
  await page.getByRole('link', { name: EN_OR_ES('Savings', 'Ahorros') }).filter({ visible: true }).first().click()
  await page.waitForURL((url) => url.pathname === '/savings')
  await expect(page.getByRole('heading', { level: 1, name: EN_OR_ES('Savings', 'Ahorros') })).toBeVisible()
}

async function gotoPath(page, path, headingRe) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: headingRe })).toBeVisible()
}

async function currencyTo(page, code) {
  await page
    .getByRole('group', { name: EN_OR_ES('Currency', 'Moneda') })
    .getByRole('button', { name: code, exact: true })
    .click()
}

const sheet = (page) => page.locator('dialog.sheet[open]')
const balanceOf = (page) => page.locator('.sv-balance .countup > .sr-only')
const totalOf = (page) => page.locator('.cur-panel.is-active .countup .sr-only').first()

async function dismissToast(page) {
  const close = page.locator('.toast-close')
  if (await close.count()) await close.first().click()
  await expect(page.locator('.toast')).toHaveCount(0)
}

async function fillMove(page, { kind, amount, note, date }) {
  await page
    .locator('.sv-actions')
    .getByRole('button', { name: kind === 'in' ? EN_OR_ES('Deposit', 'Guardar') : EN_OR_ES('Withdraw', 'Sacar') })
    .click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel(EN_OR_ES('Amount', 'Monto')).fill(amount)
  if (date) await sheet(page).getByLabel(EN_OR_ES('Date', 'Fecha')).fill(date)
  if (note) await sheet(page).getByLabel(/^(Note|Nota)/).fill(note)
}
const submitButton = (page) => sheet(page).getByRole('button', { name: /^(Deposit|Withdraw|Guardar|Sacar|Saving|Guardando)/ })

async function doMove(page, opts) {
  await fillMove(page, opts)
  await submitButton(page).click()
  await expect(sheet(page)).toHaveCount(0)
}

async function createGoal(page, { name, target }) {
  await page.getByRole('button', { name: EN_OR_ES('New goal', 'Nueva meta') }).click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel(EN_OR_ES('Goal name', 'Nombre de la meta')).fill(name)
  await sheet(page).getByLabel(EN_OR_ES('Goal amount', 'Monto de la meta')).fill(target)
  await sheet(page).getByRole('button', { name: EN_OR_ES('Save', 'Guardar') }).click()
  await expect(sheet(page)).toHaveCount(0)
  await expect(page.locator('.sv-goal').filter({ hasText: name })).toBeVisible()
}

async function pickSource(page, name) {
  await page
    .getByRole('group', { name: EN_OR_ES('Income source', 'Fuente del ingreso') })
    .getByRole('button', { name })
    .click()
}

async function addIncome(page, { amount, currency = 'CRC', source, note }) {
  await addEntry(page, { type: 'income', currency, amount, note, save: false })
  if (source) await pickSource(page, source)
  await saveButton(page).click()
  await page.waitForURL((url) => !/^\/(add|edit)(\/|$)/.test(url.pathname), { timeout: 30_000 })
  await expect(page.locator('.toast-message')).toHaveText(EN_OR_ES('Income saved', 'Ingreso guardado'))
}

// Installs a recorder of coin / burst / toast / row insertions with timestamps
async function recordOrder(page) {
  await page.evaluate(() => {
    window.__events = []
    window.__order?.disconnect()
    window.__order = new MutationObserver((records) => {
      const now = performance.now()
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue
          const has = (sel) => node.matches(sel) || node.querySelector(sel)
          if (has('.coin')) window.__events.push({ what: 'coin', at: now })
          if (has('.piggy-burst')) window.__events.push({ what: 'burst', at: now })
          if (has('.toast-message')) window.__events.push({ what: 'toast', at: now })
          if (has('.sv-row')) window.__events.push({ what: 'row', at: now })
        }
      }
    })
    window.__order.observe(document.body, { subtree: true, childList: true })
  })
}
const events = (page) => page.evaluate(() => window.__events)

async function noHorizontalScroll(page, label) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
  expect(o.sw, `horizontal scroll at ${label}`).toBeLessThanOrEqual(o.iw)
}

async function setTheme(page, mode) {
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value
  }, mode)
  await page.waitForTimeout(250)
}

// Layout problems found in the DOM: elements wider than the window, text cut
// by overflow:hidden and the tab bar hiding the last content
async function layoutProblems(page) {
  return page.evaluate(() => {
    const problems = []
    const iw = window.innerWidth
    const visible = (el) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
    }
    const main = document.querySelector('main') ?? document.body
    for (const el of main.querySelectorAll('*')) {
      if (!visible(el)) continue
      if (el.closest('.sr-only') || el.classList.contains('sr-only')) continue
      const r = el.getBoundingClientRect()
      // decorative parts (confetti, coin, burst) may travel off box on purpose
      if (el.closest('.piggy-burst, .coin, .rc-bar-track, svg')) continue
      let scroller = false
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX
        if (ox === 'auto' || ox === 'scroll') scroller = true
      }
      if (scroller) continue
      if (r.right > iw + 1 || r.left < -1) {
        problems.push(`outside the window: ${el.tagName}.${String(el.className).slice(0, 40)} [${Math.round(r.left)}..${Math.round(r.right)}]`)
      }
      const s = getComputedStyle(el)
      if (
        el.children.length === 0 &&
        el.textContent.trim() !== '' &&
        (s.overflow === 'hidden' || s.overflowX === 'hidden') &&
        el.scrollWidth > el.clientWidth + 1 &&
        s.textOverflow !== 'ellipsis'
      ) {
        problems.push(`clipped text: ${el.tagName}.${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 30)}"`)
      }
    }
    // piggy vs the balance block
    const pig = document.querySelector('.piggy')
    const bal = document.querySelector('.sv-balance')
    if (pig && bal) {
      const a = pig.getBoundingClientRect()
      const b = bal.getBoundingClientRect()
      const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
      if (overlap) problems.push(`piggy overlaps balance (${Math.round(a.bottom)} vs ${Math.round(b.top)})`)
    }
    return problems
  })
}

// scrolled to the bottom, the last card must end above the bottom tab bar
async function tabBarCoversContent(page) {
  return page.evaluate(async () => {
    const bar = document.querySelector('nav.tab-bar')
    if (!bar || getComputedStyle(bar).display === 'none') return null
    window.scrollTo(0, document.documentElement.scrollHeight)
    await new Promise((r) => setTimeout(r, 150))
    const barTop = bar.getBoundingClientRect().top
    const cards = [...document.querySelectorAll('main .card, main section, main ul, main p')].filter(
      (el) => el.getBoundingClientRect().height > 0,
    )
    const last = Math.max(...cards.map((el) => el.getBoundingClientRect().bottom))
    return { barTop: Math.round(barTop), lastBottom: Math.round(last), covered: last > barTop + 1 }
  })
}

// ---- 1. income CRUD, amounts, accounting ----------------------------------------

test.describe('QA income', () => {
  test('CRUD in CRC and USD with sources; edit and delete; totals per currency', async ({ page }) => {
    test.setTimeout(180_000)
    const errors = watchConsole(page)
    await registerAndEnter(page, account(1))
    await addIncome(page, { amount: '500000', source: 'Salary', note: 'Pay' })
    await addIncome(page, { amount: '1234.56', currency: 'USD', source: 'Freelance', note: 'Web' })
    await addIncome(page, { amount: '0.01', currency: 'USD', source: 'Gift', note: 'Cent' })
    await gotoPath(page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await currencyTo(page, 'USD')
    await expect(totalOf(page)).toHaveText('+$1,234.57')
    await currencyTo(page, 'CRC')
    await expect(totalOf(page)).toHaveText('+₡500.000')

    // edit the amount of the salary to a decimal CRC and change the source
    await page.locator('.income-main .hist-row').filter({ hasText: 'Pay' }).click()
    await expect(page).toHaveURL(/\/edit\/\d+$/)
    const amountEl = page.locator('.add-amount')
    const before = norm(await amountEl.innerText())
    expect(before).toContain('500.000')
    // clear and type a new amount: backspace everything
    await expect(async () => {
      await page.keyboard.press('Backspace')
      await expect(amountEl).not.toContainText('500.000', { timeout: 500 })
    }).toPass()
    for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace')
    await typeAmountKeys(page, '750000')
    await pickSource(page, 'Other')
    await saveButton(page).click()
    await expect(page).toHaveURL(/\/income$/)
    await expect(totalOf(page)).toHaveText('+₡750.000')

    // delete the USD 'Web' one
    await currencyTo(page, 'USD')
    await page.locator('.income-main .hist-row').filter({ hasText: 'Web' }).click()
    await page.getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
    await page.locator('dialog.modal[open]').getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
    await expect(page).toHaveURL(/\/income$/)
    await expect(totalOf(page)).toHaveText('+$0.01')
    expect(errors, 'console errors on income flows').toEqual([])
  })

  test('amount edge cases on the Add screen: zero, cent, 1.000.000.000, above max', async ({ page }) => {
    test.setTimeout(120_000)
    await registerAndEnter(page, account(2))
    await goTo(page, 'add')
    await page.getByRole('group', { name: EN_OR_ES('Type', 'Tipo') }).getByRole('button', { name: EN_OR_ES('Income', 'Ingreso') }).click()
    await expect(saveButton(page)).toBeDisabled()
    await typeAmountKeys(page, '0')
    await expect(saveButton(page), 'zero amount must not be saveable').toBeDisabled()
    await typeAmountKeys(page, '.0')
    await expect(saveButton(page), '0.0 must not be saveable').toBeDisabled()
    await typeAmountKeys(page, '1')
    await expect(saveButton(page)).toBeEnabled()
    await saveButton(page).click()
    await page.waitForURL((url) => url.pathname === '/')
    // the maximum
    await goTo(page, 'add')
    await page.getByRole('group', { name: EN_OR_ES('Type', 'Tipo') }).getByRole('button', { name: EN_OR_ES('Income', 'Ingreso') }).click()
    await typeAmountKeys(page, '1000000000')
    const shownMax = norm(await page.locator('.add-amount').innerText())
    await typeAmountKeys(page, '1')
    const shownOver = norm(await page.locator('.add-amount').innerText())
    // one more digit must not be accepted (or must not be saveable)
    expect(shownOver, 'the digit above the maximum is not accepted').toBe(shownMax)
    await expect(saveButton(page)).toBeEnabled()
    await saveButton(page).click()
    await page.waitForURL((url) => url.pathname === '/')
    await gotoPath(page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await currencyTo(page, 'CRC')
    await expect(totalOf(page)).toHaveText('+₡1.000.000.001')
  })

  test('duplicate submission: rapid clicks on Save in Add income give one record', async ({ page }) => {
    test.setTimeout(120_000)
    await registerAndEnter(page, account(3))
    await addEntry(page, { type: 'income', amount: '777', note: 'Once', save: false })
    // two synchronous clicks in the same tick and a third a moment later
    await page.evaluate(() => {
      const b = document.querySelector('button.save-key')
      b.click()
      b.click()
    })
    await page.waitForURL((url) => url.pathname === '/')
    await gotoPath(page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await expect(page.locator('.income-main .hist-row')).toHaveCount(1)
    await goTo(page, 'history')
    await expect(page.locator('.hist-row')).toHaveCount(1)
  })

  test('income persists after reload and after sign out then sign in', async ({ page }) => {
    test.setTimeout(150_000)
    const a = account(4)
    await registerAndEnter(page, a)
    await addIncome(page, { amount: '4321', source: 'Gift', note: 'Persist' })
    await gotoPath(page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await currencyTo(page, 'CRC')
    await page.reload()
    await expectInApp(page)
    await expect(totalOf(page)).toHaveText('+₡4.321')
    await signOut(page)
    await expect(page).toHaveURL(/\/login/)
    await page.getByLabel(/^(Email|Correo)$/).fill(a.email)
    await fillSignIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
    await gotoPath(page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await currencyTo(page, 'CRC')
    await expect(totalOf(page)).toHaveText('+₡4.321')
    await expect(page.locator('.income-main .hist-row')).toHaveCount(1)
  })
})

// ---- 2. savings accounting in the UI -------------------------------------------

test.describe('QA savings', () => {
  test('deposits and withdrawals never change income, expenses, History totals, Statistics or the report', async ({ page, context }) => {
    test.setTimeout(240_000)
    await stubPrint(context)
    const errors = watchConsole(page)
    await registerAndEnter(page, account(5))
    await addEntry(page, { type: 'income', amount: '100000', note: 'Pay' })
    await addEntry(page, { type: 'expense', amount: '30000', note: 'Food' })

    const snapshot = async () => {
      await goTo(page, 'home')
      const home = await getTotals(page)
      await goTo(page, 'history')
      const hist = await historySummary(page)
      await goTo(page, 'stats')
      const stats = norm(await page.locator('main').innerText())
      return { home, hist, stats }
    }
    const before = await snapshot()

    await openSavings(page)
    await currencyTo(page, 'CRC')
    await doMove(page, { kind: 'in', amount: '20000', note: 'to piggy' })
    await dismissToast(page)
    await doMove(page, { kind: 'out', amount: '5000', note: 'from piggy' })
    await dismissToast(page)
    await expect(balanceOf(page)).toHaveText('₡15.000')
    // the estimated leftover is NOT the savings: 100.000 - 30.000
    await expect(page.locator('.sv-surplus .countup > .sr-only')).toHaveText('₡70.000')

    const after = await snapshot()
    // History income/spent figures are identical
    const flat = (h) => JSON.stringify(h.map((x) => x.figures.join('|')))
    expect(flat(after.hist), 'History totals').toEqual(flat(before.hist))
    // Home: income and spent identical (the "left" figure may move by design)
    console.log('QA home before', JSON.stringify(before.home), 'after', JSON.stringify(after.home))
    console.log('QA hist', JSON.stringify(before.hist), JSON.stringify(after.hist))

    // the Income screen has no savings in it
    await gotoPath(page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await currencyTo(page, 'CRC')
    await expect(totalOf(page)).toHaveText('+₡100.000')
    await expect(page.locator('.income-main .hist-row')).toHaveCount(1)

    // the report
    await page.goto('/report')
    await page.waitForTimeout(800)
    const report = norm(await page.locator('body').innerText())
    console.log('QA report:', report.slice(0, 600))
    expect(report).toContain('100.000')
    expect(report).toContain('30.000')
    expect(errors, 'console errors').toEqual([])
  })

  test('animation only after the write resolved; order row -> coin -> toast; milestone not repeated on reload', async ({ page, context }) => {
    test.setTimeout(240_000)
    const errors = watchConsole(page)
    await registerAndEnter(page, account(6))
    await openSavings(page)
    await currencyTo(page, 'CRC')
    await createGoal(page, { name: 'Bike', target: '1000' })
    await dismissToast(page)

    // slow the page down so the write takes visibly long (CDP is available in Edge/Chromium)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
    await recordOrder(page)
    await fillMove(page, { kind: 'in', amount: '1000', note: 'Reach' })
    // at the instant of the click: sheet is open and busy
    const clickedAt = await page.evaluate(() => performance.now())
    await submitButton(page).click()
    // while the sheet is still open (write unresolved) there must be no coin
    const during = await page.evaluate(() => ({
      sheetOpen: !!document.querySelector('dialog.sheet[open]'),
      coins: document.querySelectorAll('.coin').length,
      bursts: document.querySelectorAll('.piggy-burst').length,
    }))
    if (during.sheetOpen) {
      expect(during.coins, 'coin while the write is unresolved').toBe(0)
      expect(during.bursts).toBe(0)
    }
    await expect(page.locator('.sv-goal').filter({ hasText: 'Bike' })).toContainText(/Reached on/)
    await page.waitForTimeout(2500)
    const ev = await events(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    console.log('QA order events', JSON.stringify(ev.map((e) => [e.what, Math.round(e.at - clickedAt)])))
    const first = (what) => ev.find((e) => e.what === what)
    expect(first('row'), 'a row was inserted').toBeTruthy()
    expect(first('coin'), 'a coin was inserted').toBeTruthy()
    expect(first('toast'), 'a toast was inserted').toBeTruthy()
    expect(first('coin').at, 'coin not before the row (the saved data)').toBeGreaterThanOrEqual(first('row').at)
    expect(first('toast').at, 'toast after the coin').toBeGreaterThanOrEqual(first('coin').at)
    expect(ev.filter((e) => e.what === 'coin').length).toBe(1)
    expect(ev.filter((e) => e.what === 'burst').length).toBe(1)

    // reload: no coin, no burst, goal stays reached
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: EN_OR_ES('Savings', 'Ahorros') })).toBeVisible()
    await recordOrder(page)
    await currencyTo(page, 'CRC')
    await page.waitForTimeout(1500)
    expect((await events(page)).filter((e) => e.what === 'coin' || e.what === 'burst')).toEqual([])
    await expect(page.locator('.sv-goal').filter({ hasText: 'Bike' })).toContainText(/Reached on/)
    // a later deposit does not celebrate the same goal again
    await recordOrder(page)
    await doMove(page, { kind: 'in', amount: '10' })
    await page.waitForTimeout(1500)
    const later = await events(page)
    expect(later.filter((e) => e.what === 'burst')).toEqual([])
    expect(later.filter((e) => e.what === 'coin').length).toBe(1)
    expect(errors, 'console errors').toEqual([])
  })

  test('duplicate submission on the deposit sheet gives one record (two clicks in one tick and Enter twice)', async ({ page }) => {
    test.setTimeout(120_000)
    await registerAndEnter(page, account(7))
    await openSavings(page)
    await currencyTo(page, 'CRC')
    await fillMove(page, { kind: 'in', amount: '1500', note: 'Dup' })
    await page.evaluate(() => {
      const b = document.querySelector('dialog.sheet[open] button[type="submit"]')
      b.click()
      b.click()
      b.click()
    })
    await expect(sheet(page)).toHaveCount(0)
    await page.waitForTimeout(800)
    await expect(page.locator('.sv-row')).toHaveCount(1)
    await expect(balanceOf(page)).toHaveText('₡1.500')
    // Enter pressed twice quickly in the field
    await fillMove(page, { kind: 'in', amount: '100', note: 'Enter' })
    await page.evaluate(() => {
      const form = document.querySelector('dialog.sheet[open] form')
      form.requestSubmit()
      form.requestSubmit()
    })
    await expect(sheet(page)).toHaveCount(0)
    await page.waitForTimeout(800)
    await expect(page.locator('.sv-row')).toHaveCount(2)
    await expect(balanceOf(page)).toHaveText('₡1.600')
  })

  test('boundaries: goal one cent below does not reach, exactly at target does; withdrawal above refused; achievedAt kept', async ({ page }) => {
    test.setTimeout(180_000)
    await registerAndEnter(page, account(8))
    await openSavings(page)
    await currencyTo(page, 'USD')
    await createGoal(page, { name: 'Edge', target: '100.50' })
    await dismissToast(page)
    await doMove(page, { kind: 'in', amount: '100.49' })
    await dismissToast(page)
    await expect(page.locator('.sv-goal').filter({ hasText: 'Edge' })).not.toContainText(/Reached on/)
    await expect(balanceOf(page)).toHaveText('$100.49')
    await doMove(page, { kind: 'in', amount: '0.01' })
    await expect(page.locator('.sv-goal').filter({ hasText: 'Edge' })).toContainText(/Reached on/)
    await dismissToast(page)
    // withdrawal above the balance by one cent: refused in the form
    await fillMove(page, { kind: 'out', amount: '100.51' })
    await expect(sheet(page).getByRole('alert')).toBeVisible()
    await submitButton(page).click()
    await expect(sheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(balanceOf(page)).toHaveText('$100.50')
    // exact balance allowed, goal keeps its achieved state
    await doMove(page, { kind: 'out', amount: '100.50' })
    await expect(balanceOf(page)).toHaveText('$0.00')
    await expect(page.locator('.sv-goal').filter({ hasText: 'Edge' })).toContainText(/Reached on/)
    // balance 0 -> again deposit: never celebrates again
    await dismissToast(page)
    await recordOrder(page)
    await doMove(page, { kind: 'in', amount: '500' })
    await page.waitForTimeout(1500)
    expect((await events(page)).filter((e) => e.what === 'burst')).toEqual([])
  })

  test('amount validation on the deposit sheet: zero, decimal ",", huge, invalid, 1.000.000.000', async ({ page }) => {
    test.setTimeout(120_000)
    await registerAndEnter(page, account(9))
    await openSavings(page)
    await currencyTo(page, 'CRC')
    await fillMove(page, { kind: 'in', amount: '1000000000' })
    await submitButton(page).click()
    await expect(sheet(page)).toHaveCount(0)
    await expect(balanceOf(page)).toHaveText('₡1.000.000.000')
    await dismissToast(page)
    for (const bad of ['0', '0,00', '-5', '1e3', '1.5.5', ' ', '1000000000,01']) {
      await fillMove(page, { kind: 'in', amount: bad })
      await submitButton(page).click()
      await expect(sheet(page), `"${bad}" must be refused`).toBeVisible()
      await expect(sheet(page).getByRole('alert').first()).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(sheet(page)).toHaveCount(0)
    }
    await expect(page.locator('.sv-row')).toHaveCount(1)
    // dollars: fractions
    await currencyTo(page, 'USD')
    await doMove(page, { kind: 'in', amount: '0.10' })
    await dismissToast(page)
    await doMove(page, { kind: 'in', amount: '0.20' })
    await expect(balanceOf(page)).toHaveText('$0.30')
  })

  test('persistence: savings, goals and recap after reload and after sign out then sign in', async ({ page }) => {
    test.setTimeout(180_000)
    const a = account(10)
    await registerAndEnter(page, a)
    await addEntry(page, { type: 'income', amount: '90000', note: 'Pay' })
    await openSavings(page)
    await currencyTo(page, 'CRC')
    await createGoal(page, { name: 'Keep', target: '5000' })
    await dismissToast(page)
    await doMove(page, { kind: 'in', amount: '5000', note: 'Full' })
    await dismissToast(page)
    await signOut(page)
    await expect(page).toHaveURL(/\/login/)
    await fillSignIn(page, a.email, a.password)
    await passConsentAndWelcome(page)
    await gotoPath(page, '/savings', EN_OR_ES('Savings', 'Ahorros'))
    await currencyTo(page, 'CRC')
    await recordOrder(page)
    await expect(balanceOf(page)).toHaveText('₡5.000')
    await expect(page.locator('.sv-goal').filter({ hasText: 'Keep' })).toContainText(/Reached on/)
    await page.waitForTimeout(1500)
    expect((await events(page)).filter((e) => e.what === 'coin' || e.what === 'burst')).toEqual([])
    await page.getByRole('link', { name: EN_OR_ES('Year recap', 'Resumen del año') }).click()
    await expect(page.locator('.rc-card[data-currency="CRC"]')).toBeVisible()
  })

  test('reduced motion: no coin travel, no burst, final values at once, no console errors', async ({ page }) => {
    test.setTimeout(150_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors = watchConsole(page)
    await registerAndEnter(page, account(11))
    await openSavings(page)
    await currencyTo(page, 'CRC')
    await createGoal(page, { name: 'Calm', target: '300' })
    await dismissToast(page)
    await recordOrder(page)
    await doMove(page, { kind: 'in', amount: '300' })
    await expect(balanceOf(page)).toHaveText('₡300')
    await page.waitForTimeout(1200)
    const ev = await events(page)
    expect(ev.filter((e) => e.what === 'coin' || e.what === 'burst'), 'no coin / burst with reduced motion').toEqual([])
    const anim = await page.evaluate(() => document.getAnimations().filter((x) => x.playState === 'running').length)
    console.log('QA running animations under reduced motion:', anim)
    await page.getByRole('link', { name: EN_OR_ES('Year recap', 'Resumen del año') }).click()
    await expect(page.locator('.rc-card[data-currency="CRC"]')).toBeVisible()
    const figure = page.locator('.rc-card[data-currency="CRC"] .countup > .sr-only').first()
    await expect(figure).toBeVisible()
    // digits shown are final immediately
    const shown = await page.locator('.rc-card[data-currency="CRC"] .countup-frame .money > span[aria-hidden="true"]').allInnerTexts()
    console.log('QA recap digits (reduced motion):', JSON.stringify(shown))
    expect(errors, 'console errors').toEqual([])
  })
})

// ---- 3. existing flows still work -----------------------------------------------

test('existing flows: add/edit/delete expense, History, Statistics, Settings, Home, with no console errors', async ({ page }) => {
  test.setTimeout(150_000)
  const errors = watchConsole(page)
  await registerAndEnter(page, account(12))
  await addEntry(page, { amount: '2500', category: 'Food', note: 'Snack' })
  await goTo(page, 'history')
  await page.locator('.hist-row').filter({ hasText: 'Snack' }).click()
  await expect(page).toHaveURL(/\/edit\/\d+$/)
  await expect(async () => {
    await page.keyboard.press('Backspace')
    await expect(page.locator('.add-amount')).not.toContainText('2.500', { timeout: 500 })
  }).toPass()
  for (let i = 0; i < 8; i++) await page.keyboard.press('Backspace')
  await typeAmountKeys(page, '3100')
  await saveButton(page).click()
  await page.waitForURL((url) => url.pathname !== '/edit' && !/^\/edit\//.test(url.pathname))
  await goTo(page, 'history')
  await expect(page.locator('.hist-row').filter({ hasText: 'Snack' }).locator('.hist-row-amount')).toContainText('3.100')
  await page.locator('.hist-row').filter({ hasText: 'Snack' }).click()
  await page.getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
  await page.locator('dialog.modal[open]').getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
  await goTo(page, 'history')
  await expect(page.locator('.hist-row').filter({ hasText: 'Snack' })).toHaveCount(0)
  await goTo(page, 'stats')
  await goTo(page, 'settings')
  await goTo(page, 'home')
  expect(errors, 'console errors').toEqual([])
})

// ---- 4. viewports, themes, screenshots ------------------------------------------

const VIEWPORTS = [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 700],
]

test('layout: no horizontal scroll, no clipping, piggy clear of the balance, tab bar not covering - 5 sizes x 2 themes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sizes are set by the test itself')
  test.setTimeout(480_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const errors = watchConsole(page)
  await registerAndEnter(page, account(13))

  // empty states first
  const problems = []
  const record = async (label) => {
    await noHorizontalScroll(page, label).catch((e) => problems.push(e.message.split('\n')[0]))
    for (const p of await layoutProblems(page)) problems.push(`${label}: ${p}`)
    const cover = await tabBarCoversContent(page)
    if (cover?.covered) problems.push(`${label}: tab bar covers content ${JSON.stringify(cover)}`)
    await page.evaluate(() => window.scrollTo(0, 0))
  }

  const sweep = async (name, prepare) => {
    for (const [w, h] of VIEWPORTS) {
      await page.setViewportSize({ width: w, height: h })
      for (const mode of ['dark', 'light']) {
        await prepare()
        await setTheme(page, mode)
        const label = `${name} ${w}x${h} ${mode}`
        await record(label)
        await page.screenshot({ path: `${SHOTS}/qa-${name}-${w}x${h}-${mode}.png` })
        if (w <= 768) await page.screenshot({ path: `${SHOTS}/qa-${name}-${w}x${h}-${mode}-full.png`, fullPage: true })
      }
    }
  }

  await sweep('income-empty', async () => gotoPath(page, '/income', EN_OR_ES('Income', 'Ingresos')))
  await sweep('savings-empty', async () => gotoPath(page, '/savings', EN_OR_ES('Savings', 'Ahorros')))

  // data
  await page.setViewportSize({ width: 1440, height: 900 })
  await addIncome(page, { amount: '800000', source: 'Salary', note: 'Pay' })
  await addIncome(page, { amount: '250.5', currency: 'USD', source: 'Freelance', note: 'A very long note about a freelance job that goes on and on' })
  await addEntry(page, { type: 'expense', amount: '120000', note: 'Rent' })
  await openSavings(page)
  await currencyTo(page, 'CRC')
  await createGoal(page, { name: 'Trip to Guanacaste with the whole family', target: '500000' })
  await createGoal(page, { name: 'Laptop', target: '100000' })
  await dismissToast(page)
  await doMove(page, { kind: 'in', amount: '1234568', note: 'Big bonus with a long note to wrap the row text around' })
  await dismissToast(page)
  await doMove(page, { kind: 'in', amount: '40000', note: 'Old', date: `${year - 1}-12-31` })
  await dismissToast(page)
  await page.waitForTimeout(3000)

  await sweep('home', async () => gotoPath(page, '/', /./))
  await sweep('income-data', async () => {
    await gotoPath(page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await currencyTo(page, 'CRC')
  })
  await sweep('savings-data', async () => {
    await gotoPath(page, '/savings', EN_OR_ES('Savings', 'Ahorros'))
    await currencyTo(page, 'CRC')
    await page.waitForTimeout(600)
  })
  await sweep('savings-usd-empty', async () => {
    await gotoPath(page, '/savings', EN_OR_ES('Savings', 'Ahorros'))
    await currencyTo(page, 'USD')
    await page.waitForTimeout(400)
  })
  await sweep('deposit-sheet', async () => {
    await gotoPath(page, '/savings', EN_OR_ES('Savings', 'Ahorros'))
    await currencyTo(page, 'CRC')
    await fillMove(page, { kind: 'out', amount: '99999999999' })
    await page.waitForTimeout(400)
  })
  await page.keyboard.press('Escape')
  await sweep('goal-dialog', async () => {
    await gotoPath(page, '/savings', EN_OR_ES('Savings', 'Ahorros'))
    await currencyTo(page, 'CRC')
    await page.getByRole('button', { name: EN_OR_ES('New goal', 'Nueva meta') }).click()
    await expect(sheet(page)).toBeVisible()
    await sheet(page).getByLabel(EN_OR_ES('Goal name', 'Nombre de la meta')).fill('X'.repeat(40))
    await page.waitForTimeout(400)
  })
  await sweep('recap', async () => {
    await gotoPath(page, `/savings/recap/${year}`, /./)
    await page.waitForTimeout(2000)
  })
  console.log('QA layout problems:\n' + problems.join('\n'))
  expect(problems, 'layout problems').toEqual([])
  expect(errors, 'console errors').toEqual([])
})

// ---- 5. isolation by browser profile ---------------------------------------------

test('two contexts with two accounts at once do not see each other\'s income, savings or goals', async ({ browser }) => {
  test.setTimeout(240_000)
  const opts = { baseURL: 'http://localhost:5300', locale: 'en-US', serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }
  const make = async () => {
    const fake = new FakeAuth()
    const context = await browser.newContext(opts)
    await installNetwork(context, fake)
    const page = await context.newPage()
    return { fake, context, page }
  }
  const one = await make()
  const two = await make()
  try {
    await registerAndEnter(one.page, account(14))
    await registerAndEnter(two.page, account(15))
    await addIncome(one.page, { amount: '11111', source: 'Salary', note: 'ONE-income' })
    await openSavings(one.page)
    await currencyTo(one.page, 'CRC')
    await createGoal(one.page, { name: 'ONE-goal', target: '9000' })
    await dismissToast(one.page)
    await doMove(one.page, { kind: 'in', amount: '2222', note: 'ONE-move' })

    await openSavings(two.page)
    await currencyTo(two.page, 'CRC')
    await expect(balanceOf(two.page)).toHaveText('₡0')
    await expect(two.page.locator('.sv-goal')).toHaveCount(0)
    await expect(two.page.locator('.sv-row')).toHaveCount(0)
    await addIncome(two.page, { amount: '33', source: 'Gift', note: 'TWO-income' })
    await gotoPath(two.page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await currencyTo(two.page, 'CRC')
    await expect(two.page.locator('.income-main .hist-row')).toHaveCount(1)
    await expect(two.page.locator('body')).not.toContainText('ONE-')

    // and one is untouched by two
    await gotoPath(one.page, '/income', EN_OR_ES('Income', 'Ingresos'))
    await currencyTo(one.page, 'CRC')
    await expect(one.page.locator('.income-main .hist-row')).toHaveCount(1)
    await expect(one.page.locator('body')).not.toContainText('TWO-')
    await gotoPath(one.page, '/savings', EN_OR_ES('Savings', 'Ahorros'))
    await currencyTo(one.page, 'CRC')
    await expect(balanceOf(one.page)).toHaveText('₡2.222')
    expect(one.fake.firestore).toEqual([])
    expect(two.fake.firestore).toEqual([])
    void dateStr
  } finally {
    await one.context.close()
    await two.context.close()
  }
})
