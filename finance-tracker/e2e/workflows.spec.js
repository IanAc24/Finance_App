import { test, expect } from './support/fixtures.js'
import { account } from './support/accounts.js'
import {
  addEntry,
  addAmountText,
  dateStr,
  expectInApp,
  expectNoAppData,
  expectSignInScreen,
  fillSignIn,
  goTo,
  historyRows,
  historySummary,
  norm,
  registerAndEnter,
  saveButton,
  signOut,
} from './support/app.js'

// Workflows of a person using the app (Agent D). Data lives in the browser's
// local SQLite (VITE_DATA_BACKEND=local).

const ES_OR_EN = (en, es) => new RegExp(`^(${en}|${es})$`)
const yesterdayOrToday = () => (new Date().getDate() > 1 ? 1 : 0)

async function reloadIntoApp(page) {
  await page.reload()
  await expectInApp(page)
}

test.describe('full flow', () => {
  test('1 pruebacorreo1: register, add, history, stats, reload, edit, delete, sign out and in', async ({ page, fake }, testInfo) => {
    test.setTimeout(120_000)
    const a = account(1)
    await registerAndEnter(page, a)

    // add an expense with keypad taps, a category, a payment method and a note
    const daysAgo = yesterdayOrToday()
    await addEntry(page, {
      amount: '4500',
      keys: false,
      category: 'Food',
      payment: 'Card',
      note: 'Lunch',
      daysAgo,
    })
    // back on Home after saving
    await expect(page).toHaveURL(/localhost:5300\/$/)

    // an income that stays to the end
    await addEntry(page, { type: 'income', currency: 'USD', amount: '120.5', note: 'Salary' })

    // see it in History: right day, amount, category
    await goTo(page, 'history')
    const daySection = page.locator(`section.day-group[aria-labelledby="day-${dateStr(daysAgo)}"]`)
    await expect(daySection.locator('.hist-row')).toHaveCount(1)
    const row = daySection.locator('.hist-row').first()
    await expect(row.locator('.hist-row-name')).toHaveText('Lunch')
    expect(norm(await row.locator('.hist-row-amount').innerText())).toBe('− ₡4.500')
    await expect(row.locator('.hist-row-meta')).toContainText('Food')
    await expect(row.locator('.hist-row-meta')).toContainText('Card')
    expect((await historyRows(page)).length).toBe(2)

    // Statistics and back
    await goTo(page, 'stats')
    await expect(page.getByRole('heading', { level: 1, name: ES_OR_EN('Statistics', 'Estadísticas') })).toBeVisible()
    await goTo(page, 'history')
    await expect(page.locator('.hist-row')).toHaveCount(2)

    // reload: still correct
    await reloadIntoApp(page)
    await goTo(page, 'history')
    await expect(page.locator('.hist-row')).toHaveCount(2)
    await expect(page.locator('.hist-row').filter({ hasText: 'Lunch' }).locator('.hist-row-amount')).toHaveText(/4\.500/)

    // edit amount and note
    await page.locator('.hist-row').filter({ hasText: 'Lunch' }).click()
    await expect(addAmountText(page)).toContainText('4.500')
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
    await expect(addAmountText(page)).toHaveText(/^₡0$/)
    await page.keyboard.type('7250')
    await page.getByRole('textbox', { name: /^(Note|Nota)/ }).fill('Late lunch')
    await saveButton(page).click()
    await expect(page.locator('.toast-message')).toHaveText(ES_OR_EN('Changes saved', 'Cambios guardados'))
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.locator('.hist-row').filter({ hasText: 'Late lunch' }).locator('.hist-row-amount')).toHaveText(/7\.250/)

    // reload: edited
    await reloadIntoApp(page)
    await goTo(page, 'history')
    await expect(page.locator('.hist-row').filter({ hasText: 'Late lunch' }).locator('.hist-row-amount')).toHaveText(/7\.250/)
    await expect(page.locator('.hist-row').filter({ hasText: 'Lunch' }).filter({ hasNotText: 'Late' })).toHaveCount(0)

    // delete, with the named confirmation
    await page.locator('.hist-row').filter({ hasText: 'Late lunch' }).click()
    await page.getByRole('button', { name: ES_OR_EN('Delete', 'Eliminar') }).click()
    const dialog = page.locator('dialog.modal[open]')
    await expect(dialog).toContainText('Late lunch')
    await expect(dialog).toContainText('₡7.250')
    await dialog.getByRole('button', { name: ES_OR_EN('Delete', 'Eliminar') }).click()
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.locator('.hist-row')).toHaveCount(1)

    // reload: gone
    await reloadIntoApp(page)
    await goTo(page, 'history')
    await expect(page.locator('.hist-row')).toHaveCount(1)
    await expect(page.locator('.hist-row').first()).toContainText('Salary')

    // sign out, sign in again: state is correct
    await signOut(page)
    await expectSignInScreen(page)
    await expectNoAppData(page)
    await fillSignIn(page, a.email, a.password)
    await expectInApp(page)
    await goTo(page, 'history')
    await expect(page.locator('.hist-row')).toHaveCount(1)
    await expect(page.locator('.hist-row').first()).toContainText('Salary')
    expect(norm((await historySummary(page))[0].figures.join(' '))).toContain('$120.50')
    expect(fake.count('accounts:signUp')).toBe(1)
    void testInfo
  })
})
