import { test, expect } from './support/fixtures.js'
import { account } from './support/accounts.js'
import { addEntry, registerAndEnter } from './support/app.js'

// The Savings screen (round 2 of "ingresos y ahorros"): the piggy bank and its
// coin, deposits and withdrawals per currency, goals and their milestone, the
// yearly report, the annual recap, reduced motion and screenshots.

const EN_OR_ES = (en, es) => new RegExp(`^(${en}|${es})$`)
const SHOTS = 'e2e/results/artifacts'
const year = new Date().getFullYear()

async function openSavings(page) {
  await page.getByRole('link', { name: EN_OR_ES('Savings', 'Ahorros') }).filter({ visible: true }).first().click()
  await page.waitForURL((url) => url.pathname === '/savings')
  await expect(page.getByRole('heading', { level: 1, name: EN_OR_ES('Savings', 'Ahorros') })).toBeVisible()
}

async function currencyTo(page, code) {
  await page
    .getByRole('group', { name: EN_OR_ES('Currency', 'Moneda') })
    .getByRole('button', { name: code, exact: true })
    .click()
  await expect(page.locator('.cur-seg button.is-on')).toHaveText(code)
}

const sheet = (page) => page.locator('dialog.sheet[open]')
const balanceOf = (page) => page.locator('.sv-balance .countup > .sr-only')
const toastText = (page) => page.locator('.toast-message')

async function dismissToast(page) {
  const close = page.locator('.toast-close')
  if (await close.count()) await close.first().click()
  await expect(page.locator('.toast')).toHaveCount(0)
}

// Opens the deposit / withdraw sheet and fills it (does not submit)
async function fillMove(page, { kind, amount, note, date }) {
  await page.locator('.sv-actions').getByRole('button', { name: kind === 'in' ? EN_OR_ES('Deposit', 'Guardar') : EN_OR_ES('Withdraw', 'Sacar') }).click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel(EN_OR_ES('Amount', 'Monto')).fill(amount)
  if (date) await sheet(page).getByLabel(EN_OR_ES('Date', 'Fecha')).fill(date)
  if (note) await sheet(page).getByLabel(/^(Note|Nota)/).fill(note)
}

const submitButton = (page) =>
  sheet(page).getByRole('button', { name: /^(Deposit|Withdraw|Guardar|Sacar)$/ })

// Deposits / withdraws and waits for the sheet to close
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

// Records, from now on: every frame of the coin (its box, the slot's box, how
// many animations it runs) and how many coins and bursts were ever inserted
async function recordMotion(page) {
  await page.evaluate(() => {
    window.__coin = []
    window.__counts = { coin: 0, burst: 0 }
    window.__observer?.disconnect()
    window.__observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue
          if (node.matches('.coin') || node.querySelector('.coin')) window.__counts.coin += 1
          if (node.matches('.piggy-burst') || node.querySelector('.piggy-burst')) window.__counts.burst += 1
        }
      }
    })
    window.__observer.observe(document.body, { subtree: true, childList: true })
    if (!window.__sampling) {
      window.__sampling = true
      const tick = () => {
        const coin = document.querySelector('.coin')
        const slot = document.querySelector('.pig-slot')
        if (coin && slot) {
          const c = coin.getBoundingClientRect()
          const s = slot.getBoundingClientRect()
          window.__coin.push({
            x: c.x + c.width / 2,
            y: c.y + c.height / 2,
            w: c.width,
            sx: s.x + s.width / 2,
            sy: s.y + s.height / 2,
            animations: coin.getAnimations().length,
            opacity: Number(getComputedStyle(coin).opacity),
          })
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  })
}

const counts = (page) => page.evaluate(() => window.__counts)
const distance = (s) => Math.hypot(s.x - s.sx, s.y - s.sy)

test.describe('savings screen', () => {
  test('piggy, coin, goals, milestone, currencies, year report and recap', async ({ page }) => {
    test.setTimeout(240_000)
    await registerAndEnter(page, account(1))
    // some history first, so the recap of this year is complete
    await addEntry(page, { type: 'income', amount: '100000', note: 'Pay' })
    await addEntry(page, { type: 'expense', amount: '30000', note: 'Food' })
    await openSavings(page)
    await currencyTo(page, 'CRC')

    // empty: a calm piggy that invites the first deposit; the estimated
    // leftover of the month is shown apart and is not the savings balance
    await expect(page.locator('.piggy[data-empty="true"]')).toBeVisible()
    await expect(page.getByText(/Your piggy bank is empty/)).toBeVisible()
    await expect(balanceOf(page)).toHaveText('₡0')
    await expect(page.locator('.sv-surplus .countup > .sr-only')).toHaveText('₡70.000')
    await expect(page.locator('.sv-surplus')).toContainText(/not saved until you move it to savings/)

    // ---- a deposit: the coin drops in, then the numbers move -----------------
    await recordMotion(page)
    await doMove(page, { kind: 'in', amount: '10000', note: 'QA coin' })
    await expect(toastText(page)).toHaveText('You deposited ₡10.000 into savings')
    await expect(balanceOf(page)).toHaveText('₡10.000')
    await expect(page.locator('.piggy[data-empty="false"]')).toBeVisible()
    const samples = await page.evaluate(() => window.__coin)
    expect(samples.length, 'frames with a coin').toBeGreaterThan(4)
    expect(samples.some((s) => s.animations > 0)).toBe(true)
    // it starts away from the slot, moves, and ends at the slot
    expect(distance(samples[0])).toBeGreaterThan(samples[0].w)
    expect(new Set(samples.map((s) => Math.round(s.x))).size).toBeGreaterThan(3)
    const shown = samples.filter((s) => s.opacity > 0.2)
    expect(distance(shown.at(-1))).toBeLessThan(shown.at(-1).w * 1.2)
    expect(await counts(page)).toEqual({ coin: 1, burst: 0 })
    await expect(page.locator('.coin')).toHaveCount(0)
    // the new row, in the neutral colour of savings (not income green)
    const rows = page.locator('.sv-row')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('QA coin')
    await expect(rows.first().locator('.hist-row-amount')).toHaveText('+₡10.000')
    await dismissToast(page)

    // ---- a goal and its milestone ---------------------------------------------
    await createGoal(page, { name: 'Trip', target: '15000' })
    const goal = page.locator('.sv-goal').filter({ hasText: 'Trip' })
    await expect(goal).toContainText('₡10.000 of ₡15.000')
    await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '66')
    await expect(page.locator('.sv-toward')).toContainText('Towards “Trip”: 66%')
    await dismissToast(page)

    await recordMotion(page)
    await doMove(page, { kind: 'in', amount: '5000' })
    await expect(toastText(page)).toHaveText('Goal reached! Trip · ₡15.000')
    await expect(page.locator('.piggy-burst')).toHaveCount(1)
    await expect(page.locator('.piggy-burst')).toHaveAttribute('aria-hidden', 'true')
    await expect(balanceOf(page)).toHaveText('₡15.000')
    await expect(goal).toContainText(/Reached on/)
    await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    await expect(page.locator('.piggy-burst')).toHaveCount(0, { timeout: 5000 })
    expect(await counts(page)).toEqual({ coin: 1, burst: 1 })
    await dismissToast(page)

    // a reload never celebrates again, and the goal stays reached
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: EN_OR_ES('Savings', 'Ahorros') })).toBeVisible()
    await recordMotion(page)
    await expect(page.locator('.sv-goal').filter({ hasText: 'Trip' })).toContainText(/Reached on/)
    await expect(balanceOf(page)).toHaveText('₡15.000')
    await page.waitForTimeout(1500)
    expect(await counts(page)).toEqual({ coin: 0, burst: 0 })

    // ---- dollars stay apart from colones ----------------------------------------
    await currencyTo(page, 'USD')
    await expect(balanceOf(page)).toHaveText('$0.00')
    await expect(page.locator('.piggy[data-empty="true"]')).toBeVisible()
    await expect(page.locator('.sv-goal')).toHaveCount(0)
    await expect(page.locator('.sv-row')).toHaveCount(0)
    // a withdrawal above the balance: an error, nothing written, no coin
    await fillMove(page, { kind: 'out', amount: '50' })
    await expect(sheet(page).getByRole('alert')).toContainText(/You do not have that much in savings/)
    await submitButton(page).click()
    await expect(sheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet(page)).toHaveCount(0)
    expect(await counts(page)).toEqual({ coin: 0, burst: 0 })
    await expect(balanceOf(page)).toHaveText('$0.00')

    await doMove(page, { kind: 'in', amount: '120' })
    await expect(toastText(page)).toHaveText('You deposited $120.00 into savings')
    await expect(balanceOf(page)).toHaveText('$120.00')
    await dismissToast(page)
    // taking out: restrained, neutral (no success check), counts down
    await doMove(page, { kind: 'out', amount: '50' })
    await expect(toastText(page)).toHaveText('You took $50.00 out of your savings')
    await expect(page.locator('.toast .success-check')).toHaveCount(0)
    await expect(balanceOf(page)).toHaveText('$70.00')
    expect((await counts(page)).coin).toBe(2)
    expect((await counts(page)).burst).toBe(0)
    await dismissToast(page)
    await currencyTo(page, 'CRC')
    await expect(balanceOf(page)).toHaveText('₡15.000')

    // ---- the yearly report of the year, per currency --------------------------------
    const yearRow = (key) => page.locator(`.sv-year-row dd[data-key="${key}"]`)
    await expect(yearRow('svOpening')).toHaveText('₡0')
    await expect(yearRow('svDeposited')).toHaveText('₡15.000')
    await expect(yearRow('svWithdrawn')).toHaveText('₡0')
    await expect(yearRow('svClosing')).toHaveText('₡15.000')
    await currencyTo(page, 'USD')
    await expect(yearRow('svOpening')).toHaveText('$0.00')
    await expect(yearRow('svDeposited')).toHaveText('$120.00')
    await expect(yearRow('svWithdrawn')).toHaveText('$50.00')
    await expect(yearRow('svClosing')).toHaveText('$70.00')
    await expect(page.getByText(/never reset/)).toBeVisible()

    // ---- the annual recap: both currencies, never mixed -------------------------------
    await page.getByRole('link', { name: EN_OR_ES('Year recap', 'Resumen del año') }).click()
    await expect(page).toHaveURL(new RegExp(`/savings/recap/${year}$`))
    await expect(page.getByRole('heading', { level: 1, name: `${year} recap` })).toBeVisible()
    const crc = page.locator('.rc-card[data-currency="CRC"]')
    const usd = page.locator('.rc-card[data-currency="USD"]')
    await expect(crc).toBeVisible()
    await expect(usd).toBeVisible()
    const figure = (card, label) =>
      card.locator('.rc-line').filter({ hasText: label }).locator('.countup > .sr-only')
    await expect(figure(crc, 'Total income')).toHaveText('₡100.000')
    await expect(figure(crc, 'Total expenses')).toHaveText('₡30.000')
    await expect(figure(crc, 'Estimated leftover')).toHaveText('₡70.000')
    await expect(crc.locator('.rc-line-note')).toContainText(/not the same as what was saved/)
    await expect(figure(crc, 'Deposited')).toHaveText('₡15.000')
    await expect(figure(crc, 'Closing balance')).toHaveText('₡15.000')
    await expect(crc.locator('.rc-goal-list')).toContainText('Trip')
    await expect(crc.getByRole('img')).toHaveCount(2)
    await expect(crc.getByRole('img').first()).toHaveAttribute(
      'aria-label',
      'Income ₡100.000 against expenses ₡30.000',
    )
    // dollars: savings but no recorded dollar entries -> says so, no invented numbers
    await expect(usd).toContainText('Incomplete data: your savings start before your recorded entries')
    await expect(usd.locator('.rc-line').filter({ hasText: 'Total income' })).toHaveCount(0)
    await expect(figure(usd, 'Closing balance')).toHaveText('$70.00')
    await expect(figure(usd, 'Withdrawn')).toHaveText('$50.00')
    // a year without anything
    await page.goto(`/savings/recap/${year - 3}`)
    await expect(page.locator('.rc-card[data-currency="CRC"]')).toContainText('No data in this year')
    await expect(page.locator('.rc-card[data-currency="USD"]')).toContainText('No data in this year')
  })

  test('a rapid double click on Deposit saves one movement; a delete is confirmed by name', async ({ page }) => {
    test.setTimeout(120_000)
    await registerAndEnter(page, account(2))
    await openSavings(page)
    await currencyTo(page, 'CRC')
    await fillMove(page, { kind: 'in', amount: '1000', note: 'Twice?' })
    await submitButton(page).dblclick()
    await expect(sheet(page)).toHaveCount(0)
    await expect(balanceOf(page)).toHaveText('₡1.000')
    await expect(page.locator('.sv-row')).toHaveCount(1)
    await page.waitForTimeout(600)
    await expect(page.locator('.sv-row')).toHaveCount(1)
    await expect(balanceOf(page)).toHaveText('₡1.000')

    // validation of the sheet: zero, invalid, above the global maximum
    await dismissToast(page)
    await fillMove(page, { kind: 'in', amount: '0' })
    await expect(sheet(page).getByRole('alert')).toContainText('greater than zero')
    await sheet(page).getByLabel(EN_OR_ES('Amount', 'Monto')).fill('abc')
    await expect(sheet(page).getByRole('alert')).toContainText(/valid amount/)
    await sheet(page).getByLabel(EN_OR_ES('Amount', 'Monto')).fill('1000000001')
    await expect(sheet(page).getByRole('alert')).toContainText('The largest amount is ₡1.000.000.000')
    // Enter submits
    await sheet(page).getByLabel(EN_OR_ES('Amount', 'Monto')).fill('500')
    await sheet(page).getByLabel(EN_OR_ES('Amount', 'Monto')).press('Enter')
    await expect(sheet(page)).toHaveCount(0)
    await expect(balanceOf(page)).toHaveText('₡1.500')
    await dismissToast(page)

    // deleting a movement names it in the confirmation
    await page.locator('.sv-row').filter({ hasText: 'Twice?' }).getByRole('button', { name: /^Delete/ }).click()
    const dialog = page.locator('dialog.modal[open]')
    await expect(dialog).toContainText('Twice?')
    await expect(dialog).toContainText('+₡1.000')
    await dialog.getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
    await expect(page.locator('.sv-row')).toHaveCount(1)
    await expect(balanceOf(page)).toHaveText('₡500')
  })

  test('with reduced motion there is no coin, no burst and the numbers are final at once', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await registerAndEnter(page, account(3))
    await openSavings(page)
    await currencyTo(page, 'CRC')
    await createGoal(page, { name: 'Small', target: '2000' })
    await dismissToast(page)

    await recordMotion(page)
    // every text the moving digits of the balance ever show
    await page.evaluate(() => {
      window.__frames = []
      const sample = () => {
        const node = document.querySelector('.sv-balance .countup-frame .money > span[aria-hidden="true"]')
        const text = node?.textContent?.trim()
        if (text && window.__frames.at(-1) !== text) window.__frames.push(text)
      }
      new MutationObserver(sample).observe(document.body, { subtree: true, childList: true, characterData: true })
      sample()
    })
    await doMove(page, { kind: 'in', amount: '2000' })
    await expect(balanceOf(page)).toHaveText('₡2.000')
    await expect(toastText(page)).toHaveText('Goal reached! Small · ₡2.000')
    await page.waitForTimeout(1200)
    expect(await counts(page)).toEqual({ coin: 0, burst: 0 })
    expect(await page.evaluate(() => window.__coin.length)).toBe(0)
    const frames = await page.evaluate(() => window.__frames)
    expect(frames.filter((f) => f !== '₡0' && f !== '₡2.000')).toEqual([])
    expect(await page.evaluate(() => document.querySelector('.piggy-body').getAnimations().length)).toBe(0)
    await expect(page.locator('.sv-goal').filter({ hasText: 'Small' })).toContainText(/Reached on/)
    // the level has no transition
    const transition = await page.locator('.piggy-level').evaluate((n) => getComputedStyle(n).transitionDuration)
    expect(transition).toBe('0s')
  })

  test('the piggy rises in once and the level moves with the money', async ({ page }) => {
    test.setTimeout(120_000)
    await registerAndEnter(page, account(4))
    await openSavings(page)
    await currencyTo(page, 'CRC')
    await createGoal(page, { name: 'House', target: '100000' })
    const fillOf = () => page.locator('.piggy-level').evaluate((n) => Number(n.style.getPropertyValue('--fill')))
    expect(await fillOf()).toBe(0)
    await doMove(page, { kind: 'in', amount: '25000' })
    await expect(balanceOf(page)).toHaveText('₡25.000')
    await expect.poll(fillOf).toBeCloseTo(0.25, 2)
    await expect(page.locator('.sv-goal').filter({ hasText: 'House' }).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
    // editing the goal: a lower target moves the bar
    await dismissToast(page)
    await page.getByRole('button', { name: 'Edit goal: House' }).click()
    await sheet(page).getByLabel(EN_OR_ES('Goal amount', 'Monto de la meta')).fill('50000')
    await sheet(page).getByRole('button', { name: EN_OR_ES('Save', 'Guardar') }).click()
    await expect(sheet(page)).toHaveCount(0)
    await expect.poll(fillOf).toBeCloseTo(0.5, 2)
    // deleting it asks by name
    await dismissToast(page)
    await page.getByRole('button', { name: 'Delete: House' }).click()
    await expect(page.locator('dialog.modal[open]')).toContainText('House')
    await page.locator('dialog.modal[open]').getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
    await expect(page.locator('.sv-goal')).toHaveCount(0)
    await expect(page.getByText(/You have no goals yet/)).toBeVisible()
  })
})

// Screenshots at five sizes in both themes (desktop project only: the sizes
// are set here), the recap, the empty piggy and frames in the middle of a
// deposit
const VIEWPORTS = [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 700],
]

async function theme(page, value) {
  await page.evaluate((v) => {
    document.documentElement.dataset.theme = v
  }, value)
  await page.waitForTimeout(250)
}

async function noHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, label).toBeLessThanOrEqual(0)
}

test('screenshots of Savings and the recap in both themes, and frames of a deposit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sizes are set by the test itself')
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await registerAndEnter(page, account(5))
  await addEntry(page, { type: 'income', amount: '800000', note: 'Salary' })
  await addEntry(page, { type: 'expense', amount: '120000', note: 'Rent' })
  await openSavings(page)
  await currencyTo(page, 'CRC')

  // the empty piggy
  await page.waitForTimeout(500)
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height })
    for (const mode of ['dark', 'light']) {
      await theme(page, mode)
      await page.screenshot({ path: `${SHOTS}/savings-empty-${width}x${height}-${mode}.png` })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await theme(page, 'dark')

  await createGoal(page, { name: 'Laptop', target: '100000' })
  await createGoal(page, { name: 'Trip to Guanacaste', target: '500000' })
  await dismissToast(page)
  // an old year, for the comparison rows
  await doMove(page, { kind: 'in', amount: '50000', note: 'Old savings', date: `${year - 1}-06-10` })
  await dismissToast(page)

  // frames in the middle of a deposit: the coin is paused at 80, 200, 320 and 440ms
  await fillMove(page, { kind: 'in', amount: '150000', note: 'Bonus' })
  await submitButton(page).click()
  // best effort: the frames are for looking at, they must never hang the run
  const paused = await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          const started = performance.now()
          const look = () => {
            const animation = document.querySelector('.coin')?.getAnimations()[0]
            if (animation && animation.currentTime < 250) {
              animation.pause()
              window.__coinAnimation = animation
              resolve(true)
            } else if (performance.now() - started > 3000) resolve(false)
            else requestAnimationFrame(look)
          }
          look()
        }),
    )
    .catch(() => false)
  const piggyBox = await page.locator('.piggy').boundingBox()
  const clip = { x: piggyBox.x - 40, y: piggyBox.y - 90, width: piggyBox.width + 80, height: piggyBox.height + 120 }
  let frame = 1
  for (const ms of paused ? [80, 200, 320, 440] : []) {
    await page.evaluate((time) => {
      window.__coinAnimation.currentTime = time
    }, ms)
    await page.waitForTimeout(60)
    await page.screenshot({ path: `${SHOTS}/deposit-frame-${frame}.png`, clip })
    frame += 1
  }
  await page.evaluate(() => window.__coinAnimation?.play())
  await expect(balanceOf(page)).toHaveText('₡200.000')
  await expect(page.locator('.sv-goal').filter({ hasText: 'Laptop' })).toContainText(/Reached on/)
  await dismissToast(page)
  await page.waitForTimeout(1500)

  // a milestone mid-burst
  await dismissToast(page)
  await fillMove(page, { kind: 'in', amount: '350000', note: 'Gift' })
  await submitButton(page).click()
  await expect(page.locator('.piggy-burst')).toHaveCount(1)
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('.burst-dot')) {
      for (const animation of a.getAnimations()) {
        animation.pause()
        animation.currentTime = 300
      }
    }
  })
  await page.waitForTimeout(60)
  await page.screenshot({ path: `${SHOTS}/deposit-frame-burst.png`, clip })
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('.burst-dot')) for (const animation of a.getAnimations()) animation.play()
  })
  await expect(page.locator('.piggy-burst')).toHaveCount(0, { timeout: 5000 })
  await dismissToast(page)

  // dollars, for a second currency in the same view
  await currencyTo(page, 'USD')
  await doMove(page, { kind: 'in', amount: '300', note: 'Dollars' })
  await dismissToast(page)
  await currencyTo(page, 'CRC')
  await page.waitForTimeout(800)

  for (const [width, height] of VIEWPORTS) {
    await page.setViewportSize({ width, height })
    for (const mode of ['dark', 'light']) {
      await theme(page, mode)
      await page.screenshot({ path: `${SHOTS}/savings-${width}x${height}-${mode}.png` })
      if (width < 1000) {
        await page.screenshot({ path: `${SHOTS}/savings-${width}x${height}-${mode}-full.png`, fullPage: true })
      }
      await noHorizontalScroll(page, `savings ${width}x${height} ${mode}`)
    }
  }

  // the sheet open
  await page.setViewportSize({ width: 390, height: 844 })
  await fillMove(page, { kind: 'out', amount: '999999999' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/savings-sheet-390x844-light.png` })
  await page.keyboard.press('Escape')

  // drop the old-year move (so the colones recap is complete: entries and
  // savings in the same year), then the recap
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('.sv-row').filter({ hasText: 'Old savings' }).getByRole('button', { name: /^Delete/ }).click()
  await page.locator('dialog.modal[open]').getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
  await expect(page.locator('.sv-row').filter({ hasText: 'Old savings' })).toHaveCount(0)
  await dismissToast(page)
  await page.getByRole('link', { name: EN_OR_ES('Year recap', 'Resumen del año') }).click()
  await expect(page.locator('.rc-card[data-currency="CRC"]')).toBeVisible()
  await page.waitForTimeout(1800)
  for (const [width, height] of VIEWPORTS) {
    await page.setViewportSize({ width, height })
    for (const mode of ['dark', 'light']) {
      await theme(page, mode)
      await page.screenshot({ path: `${SHOTS}/recap-${width}x${height}-${mode}.png` })
      if (width < 1000) {
        await page.screenshot({ path: `${SHOTS}/recap-${width}x${height}-${mode}-full.png`, fullPage: true })
      }
      await noHorizontalScroll(page, `recap ${width}x${height} ${mode}`)
    }
  }
})
