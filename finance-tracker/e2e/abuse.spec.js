import { test, expect } from './support/fixtures.js'
import { account } from './support/accounts.js'
import {
  addAmountText,
  addEntry,
  goTo,
  historyRows,
  open,
  registerAndEnter,
  saveButton,
  signIn,
  signOut,
  typeAmountKeys,
} from './support/app.js'

// A person trying to break the app (review of 24/10, docs/qa/revision-24-10.md).
// Each test must end with the app working and no page errors (fixtures.js
// fails a test on any uncaught error).

test.describe('abuse on the Add screen and around', () => {
  test('a huge amount stops at the cap', async ({ page }) => {
    await registerAndEnter(page, account(2))
    await goTo(page, 'add')
    await typeAmountKeys(page, '99999999999999')
    const shown = await addAmountText(page).innerText()
    // ₡999.999.999 at most: never more than 9 digits plus separators
    expect(shown.replace(/\D/g, '').length, `amount on screen: ${shown}`).toBeLessThanOrEqual(9)
  })

  test('zero or only a comma cannot be saved', async ({ page }) => {
    await registerAndEnter(page, account(3))
    await goTo(page, 'add')
    await expect(saveButton(page)).toBeDisabled()
    await typeAmountKeys(page, '0')
    await expect(saveButton(page)).toBeDisabled()
    await typeAmountKeys(page, ',')
    await expect(saveButton(page)).toBeDisabled()
  })

  test('a 500-letter note with HTML is cut to 60 and shown as text', async ({ page }) => {
    await registerAndEnter(page, account(4))
    const evil = '<img src=x onerror="window.__xss=1">' + 'a'.repeat(500)
    await addEntry(page, { amount: '1500', category: /Food|Comida/, note: evil })
    await goTo(page, 'history')
    const rows = await historyRows(page)
    expect(await page.evaluate(() => window.__xss)).toBeUndefined()
    expect(rows[0]?.name.length ?? 0, JSON.stringify(rows[0])).toBeLessThanOrEqual(60)
  })

  test('a double click on Save saves one transaction', async ({ page }) => {
    await registerAndEnter(page, account(5))
    await addEntry(page, { amount: '2000', save: false })
    await saveButton(page).dblclick()
    await page.waitForURL((url) => !/\/add/.test(url.pathname))
    await goTo(page, 'history')
    expect(await historyRows(page)).toHaveLength(1)
  })

  test('Back mid-typing and made-up addresses never break the app', async ({ page }) => {
    await registerAndEnter(page, account(6))
    await goTo(page, 'add')
    await typeAmountKeys(page, '123')
    await page.goBack()
    await page.goForward()
    for (const path of ['/no-such-page', '/edit/999999', '/edit/abc', '/settings/nothing', '/legal/x', '/registro', '/login']) {
      await open(page, path)
      // once loaded, every address lands on a real screen with its title
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('a 100-letter category name is cut to 24', async ({ page }) => {
    await registerAndEnter(page, account(7))
    // the keypad on screen: the physical keys would go into the name field
    await addEntry(page, { amount: '500', custom: 'x'.repeat(100), keys: false })
    await goTo(page, 'history')
    const rows = await historyRows(page)
    expect(rows[0]?.name.length ?? 0, JSON.stringify(rows[0])).toBeLessThanOrEqual(24)
  })

  test('without internet a transaction is added and is still there after a reload', async ({ page, context }) => {
    await registerAndEnter(page, account(8))
    await context.setOffline(true)
    await addEntry(page, { amount: '700', category: /Food|Comida/ })
    await context.setOffline(false)
    await page.reload()
    await goTo(page, 'history')
    expect(await historyRows(page)).toHaveLength(1)
  })

  test('going through every screen fast, five times, throws no error', async ({ page }) => {
    await registerAndEnter(page, account(9))
    for (let i = 0; i < 5; i++) {
      for (const where of ['home', 'add', 'history', 'stats', 'settings']) await goTo(page, where)
    }
  })

  test('sign out and back in on the same browser', async ({ page }) => {
    const a = account(10)
    await registerAndEnter(page, a)
    await signOut(page)
    await signIn(page, a.email, a.password)
    await page.waitForURL((url) => !/\/login/.test(url.pathname))
    await expect(page.locator('main').first()).toBeVisible()
  })
})
