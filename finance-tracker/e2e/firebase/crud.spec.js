import {
  addAmountText,
  expectInApp,
  goTo,
  saveButton,
} from '../support/app.js'
import { addTagged, enterAs, expect, noteFor, onlyWhenEnabled, reserveWrites, taggedRows, test, waitForServer } from './fb.js'

// Account 1 against the real project: add -> History -> reload -> edit ->
// reload -> delete -> reload. The server is checked with the SDK at each step.
onlyWhenEnabled()

const ES_OR_EN = (en, es) => new RegExp(`^(${en}|${es})$`)

test('add, reload, edit, reload, delete, reload (one tagged expense)', async ({ page, server }) => {
  reserveWrites(3) // create, update, delete
  await enterAs(page, 1)

  await addTagged(page, 'crud lunch', { amount: '4500', category: 'Food' })
  await goTo(page, 'history')
  await expect.poll(async () => (await taggedRows(page, 'crud lunch')).length).toBe(1)
  await waitForServer(server, 1, 'crud lunch', (d) => d.length === 1 && d[0].amountCents === 450000 && d[0].currency === 'CRC')

  // reload: still there
  await page.reload()
  await expectInApp(page)
  await goTo(page, 'history')
  await expect.poll(async () => (await taggedRows(page, 'crud lunch')).length).toBe(1)

  // edit amount and note
  await page.locator('.hist-row').filter({ hasText: noteFor('crud lunch') }).click()
  await expect(addAmountText(page)).toContainText('4.500')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('7250')
  await page.getByRole('textbox', { name: /^(Note|Nota)/ }).fill(noteFor('crud edited'))
  await saveButton(page).click()
  await expect(page.locator('.toast-message')).toHaveText(ES_OR_EN('Changes saved', 'Cambios guardados'))
  await waitForServer(server, 1, 'crud edited', (d) => d.length === 1 && d[0].amountCents === 725000)
  expect(await server.docs(1, 'crud lunch')).toHaveLength(0)

  // reload: edited
  await page.reload()
  await expectInApp(page)
  await goTo(page, 'history')
  await expect.poll(async () => (await taggedRows(page, 'crud edited')).length).toBe(1)
  expect(await taggedRows(page, 'crud lunch')).toHaveLength(0)

  // delete (named confirmation)
  await page.locator('.hist-row').filter({ hasText: noteFor('crud edited') }).click()
  await page.getByRole('button', { name: ES_OR_EN('Delete', 'Eliminar') }).click()
  const dialog = page.locator('dialog.modal[open]')
  await dialog.getByRole('button', { name: ES_OR_EN('Delete', 'Eliminar') }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect.poll(async () => (await taggedRows(page, 'crud edited')).length).toBe(0)
  await waitForServer(server, 1, 'crud edited', (d) => d.length === 0)

  // reload: gone
  await page.reload()
  await expectInApp(page)
  await goTo(page, 'history')
  expect(await taggedRows(page)).toHaveLength(0)
})
