import { test, expect } from './support/fixtures.js'
import { account } from './support/accounts.js'
import { addEntry, dateStr, goTo, registerAndEnter, saveButton } from './support/app.js'

// The Income screen (round 1 of "ingresos y ahorros"): totals per currency and
// period, the source of each income, the history list, edit / delete, the
// motion kit (count-up, row animations) and screenshots in both themes.

const EN_OR_ES = (en, es) => new RegExp(`^(${en}|${es})$`)
const SHOTS = 'e2e/results/artifacts'

// Opens Income through the visible menu: the top bar on desktop, the "Income"
// chip of History on phones (the bottom bar has no tab for it)
async function openIncome(page) {
  const top = page.locator('nav.top-nav').getByRole('link', { name: EN_OR_ES('Income', 'Ingresos') })
  if (await top.isVisible()) {
    await top.click()
  } else {
    await goTo(page, 'history')
    await page.locator('.hist-chips').getByRole('link', { name: EN_OR_ES('Income', 'Ingresos') }).click()
  }
  await page.waitForURL((url) => url.pathname === '/income')
  await expect(page.getByRole('heading', { level: 1, name: EN_OR_ES('Income', 'Ingresos') })).toBeVisible()
}

// Picks an income source tile on the Add screen
async function pickSource(page, name) {
  await page
    .getByRole('group', { name: EN_OR_ES('Income source', 'Fuente del ingreso') })
    .getByRole('button', { name })
    .click()
}

// Adds an income through the Add screen, with a source, and waits for the save
async function addIncome(page, { amount, currency = 'CRC', source, note }) {
  await addEntry(page, { type: 'income', currency, amount, note, save: false })
  if (source) await pickSource(page, source)
  await saveButton(page).click()
  await page.waitForURL((url) => !/^\/(add|edit)(\/|$)/.test(url.pathname), { timeout: 30_000 })
  await expect(page.locator('.toast-message')).toHaveText(EN_OR_ES('Income saved', 'Ingreso guardado'))
}

// The total on view (the final text for screen readers, not the moving digits)
const totalOf = (page) => page.locator('.cur-panel.is-active .countup .sr-only').first()
// the toast floats over the list on phones; close it before tapping a row
async function dismissToast(page) {
  const close = page.locator('.toast-close')
  if (await close.count()) await close.first().click()
  await expect(page.locator('.toast')).toHaveCount(0)
}
const rows = (page) => page.locator('.income-main .hist-row')

async function currencyTo(page, code) {
  await page
    .getByRole('group', { name: EN_OR_ES('Currency', 'Moneda') })
    .getByRole('button', { name: code, exact: true })
    .click()
}

// Records every text the moving digits show, from now on
async function recordFrames(page) {
  await page.evaluate(() => {
    window.__frames = []
    const sample = () => {
      const node = document.querySelector('.cur-panel.is-active .countup-frame .money > span[aria-hidden="true"]')
      const text = node?.textContent?.trim()
      if (text && window.__frames.at(-1) !== text) window.__frames.push(text)
    }
    window.__observer?.disconnect()
    window.__observer = new MutationObserver(sample)
    window.__observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    sample()
  })
}

async function seed(page) {
  await registerAndEnter(page, account(1))
  await addIncome(page, { amount: '500000', source: 'Salary', note: 'Pay' })
  await addIncome(page, { amount: '120000', source: 'Freelance', note: 'Logo job' })
  await addIncome(page, { amount: '30000', source: 'Gift' })
  await addIncome(page, { amount: '250.5', currency: 'USD', source: 'Freelance', note: 'Web client' })
  await addIncome(page, { amount: '20', currency: 'USD', source: 'Gift' })
}

test.describe('income screen', () => {
  test('totals per currency and period, sources, filters, edit and delete', async ({ page }) => {
    test.setTimeout(150_000)
    await seed(page)
    await openIncome(page)

    // CRC first (the last currency used was USD, so switch): never mixed
    await currencyTo(page, 'CRC')
    await expect(totalOf(page)).toHaveText('+₡650.000')
    await expect(page.locator('.income-summary .sub').filter({ hasText: /3 entries/ })).toBeVisible()
    await expect(page.locator('.income-summary')).toContainText('$270.50')
    await expect(page.locator('.income-summary')).toContainText(/You also have \$270\.50 in dollars/)
    // the breakdown by source
    const sources = page.locator('.source-row')
    await expect(sources).toHaveCount(3)
    await expect(sources.filter({ hasText: 'Salary' })).toContainText('₡500.000')
    await expect(sources.filter({ hasText: 'Freelance' })).toContainText('₡120.000')
    await expect(sources.filter({ hasText: 'Gift' })).toContainText('₡30.000')

    // the list, grouped by day, with the source in each row
    await expect(rows(page)).toHaveCount(3)
    await expect(rows(page).filter({ hasText: 'Pay' }).locator('.hist-row-amount')).toContainText('+')
    await expect(rows(page).filter({ hasText: 'Gift' })).toHaveCount(1)
    await expect(rows(page).filter({ hasText: 'Logo job' })).toContainText('Freelance')

    // USD
    await currencyTo(page, 'USD')
    await expect(totalOf(page)).toHaveText('+$270.50')
    await expect(rows(page)).toHaveCount(2)
    await expect(page.locator('.income-summary')).toContainText(/You also have ₡650\.000 in colones/)
    await currencyTo(page, 'CRC')

    // this year has the same incomes; a custom range of yesterday has none
    await page.getByRole('button', { name: EN_OR_ES('This year', 'Este año'), exact: true }).click()
    await expect(totalOf(page)).toHaveText('+₡650.000')
    await page.getByRole('button', { name: EN_OR_ES('Custom', 'Personalizado') }).click()
    const yesterday = dateStr(1)
    await page.getByLabel(EN_OR_ES('From', 'Desde')).fill(yesterday)
    await page.getByLabel(EN_OR_ES('To', 'Hasta')).fill(yesterday)
    await expect(totalOf(page)).toHaveText('₡0')
    await expect(page.getByText(/No income in this period yet/)).toBeVisible()
    // a backwards range is refused, nothing is shown for it
    await page.getByLabel(EN_OR_ES('From', 'Desde')).fill(dateStr(0))
    await expect(page.getByRole('alert').filter({ hasText: /start date/ })).toBeVisible()
    await page.getByRole('button', { name: EN_OR_ES('This month', 'Este mes') }).click()
    await expect(totalOf(page)).toHaveText('+₡650.000')

    // filter by source and search the notes
    await page.getByRole('group', { name: EN_OR_ES('Source', 'Fuente') }).getByRole('button', { name: 'Freelance' }).click()
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Logo job')
    await page.getByRole('group', { name: EN_OR_ES('Source', 'Fuente') }).getByRole('button', { name: 'All' }).click()
    await page.getByRole('searchbox', { name: EN_OR_ES('Search notes', 'Buscar en las notas') }).fill('pay')
    await expect(rows(page)).toHaveCount(1)
    await page.getByRole('searchbox', { name: EN_OR_ES('Search notes', 'Buscar en las notas') }).fill('zzz')
    await expect(page.getByText(/No income matches your search/)).toBeVisible()
    await page.getByRole('button', { name: EN_OR_ES('Clear filters', 'Quitar filtros') }).click()
    await expect(rows(page)).toHaveCount(3)

    // edit: change the source of "Logo job" to Gift; the row is tinted on return
    await rows(page).filter({ hasText: 'Logo job' }).click()
    await expect(page).toHaveURL(/\/edit\/\d+$/)
    await expect(
      page.getByRole('group', { name: EN_OR_ES('Income source', 'Fuente del ingreso') }).getByRole('button', { name: 'Freelance' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await pickSource(page, 'Gift')
    await saveButton(page).click()
    await expect(page.locator('.toast-message')).toHaveText(EN_OR_ES('Changes saved', 'Cambios guardados'))
    await expect(page).toHaveURL(/\/income$/)
    await expect(page.locator('.trow.is-edit')).toHaveCount(1)
    await expect(sources.filter({ hasText: 'Gift' })).toContainText('₡150.000')
    await expect(sources.filter({ hasText: 'Freelance' })).toHaveCount(0)
    await expect(rows(page).filter({ hasText: 'Logo job' })).toContainText('Gift')

    // add from this screen: back here, the new row rises in
    await page.getByRole('link', { name: EN_OR_ES('Add income', 'Agregar ingreso') }).click()
    await expect(page).toHaveURL(/\/add\?type=income$/)
    await expect(page.getByRole('button', { name: EN_OR_ES('Income', 'Ingreso') })).toHaveAttribute('aria-pressed', 'true')
    await addEntryHere(page, '1000')
    await expect(page).toHaveURL(/\/income$/)
    await expect(page.locator('.trow.is-enter')).toHaveCount(1)
    await expect(totalOf(page)).toHaveText('+₡651.000')
    await expect(rows(page)).toHaveCount(4)

    // delete: the row fades and closes up; the total follows
    await dismissToast(page)
    await rows(page).filter({ hasText: 'Pay' }).click()
    await page.getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
    await page.locator('dialog.modal[open]').getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
    await expect(page).toHaveURL(/\/income$/)
    await expect(rows(page)).toHaveCount(3)
    await expect(totalOf(page)).toHaveText('+₡151.000')
    await expect(sources.filter({ hasText: 'Salary' })).toHaveCount(0)
  })

  test('the source shows in History and the last salary is remembered', async ({ page }) => {
    test.setTimeout(90_000)
    await registerAndEnter(page, account(2))
    await addIncome(page, { amount: '1000', source: 'Salary' })
    await goTo(page, 'history')
    const row = page.locator('.hist-row').first()
    await expect(row.locator('.hist-row-name')).toHaveText('Salary')
    // the next income starts with Salary chosen
    await goTo(page, 'add')
    await page.getByRole('group', { name: EN_OR_ES('Type', 'Tipo') }).getByRole('button', { name: EN_OR_ES('Income', 'Ingreso') }).click()
    await expect(
      page.getByRole('group', { name: EN_OR_ES('Income source', 'Fuente del ingreso') }).getByRole('button', { name: 'Salary' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('the count-up animates a total that changes', async ({ page }) => {
    test.setTimeout(120_000)
    await seed(page)
    await openIncome(page)
    await currencyTo(page, 'CRC')
    await expect(totalOf(page)).toHaveText('+₡650.000')

    await recordFrames(page)
    await page.getByRole('button', { name: EN_OR_ES('Custom', 'Personalizado') }).click()
    await page.getByLabel(EN_OR_ES('From', 'Desde')).fill(dateStr(1))
    await page.getByLabel(EN_OR_ES('To', 'Hasta')).fill(dateStr(1))
    await expect(totalOf(page)).toHaveText('₡0')
    await expect.poll(async () => (await page.evaluate(() => window.__frames.at(-1))), { timeout: 3000 }).toBe('₡0')
    const frames = await page.evaluate(() => window.__frames)
    // moving digits: several steps, each one a well-formed amount
    expect(frames.length).toBeGreaterThan(3)
    for (const frame of frames) expect(frame).toMatch(/^\+?₡\d{1,3}(\.\d{3})*$/)
  })

  test('with reduced motion the total shows its final value at once', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seed(page)
    await openIncome(page)
    await currencyTo(page, 'CRC')
    await expect(totalOf(page)).toHaveText('+₡650.000')

    await recordFrames(page)
    await page.getByRole('button', { name: EN_OR_ES('Custom', 'Personalizado') }).click()
    await page.getByLabel(EN_OR_ES('From', 'Desde')).fill(dateStr(1))
    await page.getByLabel(EN_OR_ES('To', 'Hasta')).fill(dateStr(1))
    await expect(totalOf(page)).toHaveText('₡0')
    // no counting: the first thing shown for the new period is the final text
    const frames = await page.evaluate(() => window.__frames)
    expect(frames.at(-1)).toBe('₡0')
    expect(frames.filter((f) => f !== '+₡650.000' && f !== '₡0')).toEqual([])
    // no movement on the thumb of the currency control either
    const transition = await page.locator('.cur-seg-thumb').evaluate((n) => getComputedStyle(n).transitionDuration)
    expect(transition).toBe('0s')
  })
})

// Types an amount on the Add screen that is already open (income mode) and saves
async function addEntryHere(page, amount) {
  await expect(page.locator('.keypad')).toBeVisible()
  await page.locator('.add-toprow .seg').nth(1).getByRole('button', { name: 'CRC', exact: true }).click()
  for (const ch of amount) await page.keyboard.press(ch)
  await saveButton(page).click()
  await page.waitForURL((url) => !/^\/(add|edit)(\/|$)/.test(url.pathname), { timeout: 30_000 })
}

// Screenshots at five sizes in both themes (desktop project only: the sizes
// are set here)
const VIEWPORTS = [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 700],
]

test('screenshots of Income, Add and the navigation in both themes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sizes are set by the test itself')
  test.setTimeout(180_000)
  await seed(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openIncome(page)
  await currencyTo(page, 'CRC')
  await expect(totalOf(page)).toHaveText('+₡650.000')
  await dismissToast(page)

  for (const [width, height] of VIEWPORTS) {
    await page.setViewportSize({ width, height })
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value
      }, theme)
      await page.waitForTimeout(350)
      await page.screenshot({ path: `${SHOTS}/income-${width}x${height}-${theme}.png` })
      if (width < 800) {
        await page.screenshot({ path: `${SHOTS}/income-${width}x${height}-${theme}-full.png`, fullPage: true })
      }
      // no horizontal scroll at any size
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${width}x${height} ${theme}`).toBeLessThanOrEqual(0)
    }
  }

  // the Add screen in income mode with the source picker, and Home / History
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height })
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value
      }, theme)
      await page.goto('/add?type=income')
      await expect(page.locator('.keypad')).toBeVisible()
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value
      }, theme)
      await page.waitForTimeout(250)
      await page.screenshot({ path: `${SHOTS}/income-add-${width}x${height}-${theme}.png`, fullPage: true })
    }
  }
})

// Six tabs + brand + gear must not overlap in the top bar
test('the top bar fits six tabs: two rows below 1640px, one row from there', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sizes are set by the test itself')
  await registerAndEnter(page, account(3))
  for (const width of [900, 1024, 1280, 1360, 1440, 1639, 1640, 1680, 1920]) {
    await page.setViewportSize({ width, height: 800 })
    await page.waitForTimeout(100)
    const boxes = await page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      }
      const nav = document.querySelector('.top-nav')
      return {
        brand: rect('.app-bar .brand'),
        nav: rect('.top-nav'),
        gear: rect('.app-bar .icon-link'),
        scrolls: nav.scrollWidth > nav.clientWidth,
      }
    })
    const overlap = (a, b) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    // below 1640 the tabs are a second row (under the brand); from there all
    // share one row and must not touch
    if (width >= 1640) {
      expect(overlap(boxes.brand, boxes.nav), `brand/tabs at ${width}`).toBe(false)
      expect(overlap(boxes.nav, boxes.gear), `tabs/gear at ${width}`).toBe(false)
    } else {
      expect(boxes.nav.top, `tabs under the brand at ${width}`).toBeGreaterThanOrEqual(boxes.brand.bottom)
    }
    expect(boxes.scrolls, `tabs scroll at ${width}`).toBe(false)
    if (width === 1440 || width === 1640) await page.screenshot({ path: `${SHOTS}/income-nav-${width}.png`, clip: { x: 0, y: 0, width, height: 140 } })
  }
})
