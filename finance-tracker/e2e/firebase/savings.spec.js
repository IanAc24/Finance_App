import {
  enterAs,
  expect,
  noteFor,
  onlyWhenEnabled,
  parseMoney,
  reserveWrites,
  test,
} from './fb.js'

// The Savings screen against the real project (account 1): deposits wait for
// the server before the coin plays, a goal is created / reached / deleted,
// a withdrawal, an offline deposit that stays "pending" (no coin, no success),
// and persistence after a reload. Everything is tagged "QA-<runId> <label>" (the
// notes of the moves and the NAMES of the goals) and removed by teardown.
onlyWhenEnabled()

const EN_OR_ES = (en, es) => new RegExp(`^(${en}|${es})$`)

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
const toastText = (page) => page.locator('.toast-message')

// The savings balance on screen in cents (the text for screen readers)
async function balanceCents(page) {
  const text = await page.locator('.sv-balance .countup > .sr-only').textContent()
  return parseMoney(text).cents
}

async function dismissToast(page) {
  const close = page.locator('.toast-close')
  if (await close.count()) await close.first().click()
  await expect(page.locator('.toast')).toHaveCount(0)
}

async function fillMove(page, { kind, amount, note }) {
  await page
    .locator('.sv-actions')
    .getByRole('button', { name: kind === 'in' ? EN_OR_ES('Deposit', 'Guardar') : EN_OR_ES('Withdraw', 'Sacar') })
    .click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel(EN_OR_ES('Amount', 'Monto')).fill(amount)
  if (note) await sheet(page).getByLabel(/^(Note|Nota)/).fill(note)
}

const submit = (page) => sheet(page).getByRole('button', { name: /^(Deposit|Withdraw|Guardar|Sacar)$/ })

// Counts the coins and bursts inserted from now on
async function recordMotion(page) {
  await page.evaluate(() => {
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
  })
}
const counts = (page) => page.evaluate(() => window.__counts)

test('savings: the coin plays after the server confirmed, a goal is reached, withdrawal, offline stays pending', async ({
  page,
  context,
  server,
}) => {
  test.setTimeout(420_000)
  // moves: deposit, deposit that reaches the goal, withdrawal, offline deposit;
  // the goal: create (+ the update that marks it reached)
  reserveWrites(8)

  await enterAs(page, 1)
  await openSavings(page)
  await currencyTo(page, 'CRC')
  const start = await balanceCents(page)
  await recordMotion(page)

  // ---- deposit: the screen waits for the server, then the coin drops ----------
  await fillMove(page, { kind: 'in', amount: '10000', note: noteFor('sv dep') })
  await submit(page).click()
  // while the answer is awaited the button is busy and disabled
  await expect(sheet(page)).toHaveCount(0, { timeout: 30_000 })
  await expect(toastText(page)).toHaveText('You deposited ₡10.000 into savings')
  await expect.poll(() => balanceCents(page), { timeout: 15_000 }).toBe(start + 1_000_000)
  expect((await counts(page)).coin).toBe(1)
  // the server holds exactly that move
  await expect
    .poll(async () => (await server.moves(1, 'sv dep')).map((d) => [d.direction, d.currency, d.amountCents]), {
      timeout: 60_000,
      intervals: [1000, 2000, 3000],
    })
    .toEqual([['in', 'CRC', 1_000_000]])
  await dismissToast(page)

  // ---- a goal that the next deposit reaches ----------------------------------------
  const goalName = noteFor('sv goal')
  const target = Math.round(((await balanceCents(page)) + 500_000) / 100)
  await page.getByRole('button', { name: EN_OR_ES('New goal', 'Nueva meta') }).click()
  await sheet(page).getByLabel(EN_OR_ES('Goal name', 'Nombre de la meta')).fill(goalName)
  await sheet(page).getByLabel(EN_OR_ES('Goal amount', 'Monto de la meta')).fill(String(target))
  await sheet(page).getByRole('button', { name: EN_OR_ES('Save', 'Guardar') }).click()
  await expect(sheet(page)).toHaveCount(0, { timeout: 30_000 })
  const goal = page.locator('.sv-goal').filter({ hasText: goalName })
  await expect(goal).toBeVisible()
  await expect
    .poll(async () => (await server.goals(1, 'sv goal')).map((g) => [g.targetCents, g.currency, g.achievedAt]), {
      timeout: 60_000,
      intervals: [1000, 2000, 3000],
    })
    .toEqual([[target * 100, 'CRC', null]])
  await dismissToast(page)

  // ---- the deposit that reaches it: coin, hop and burst, once -------------------------
  await fillMove(page, { kind: 'in', amount: '5000', note: noteFor('sv reach') })
  await submit(page).click()
  await expect(sheet(page)).toHaveCount(0, { timeout: 30_000 })
  await expect(toastText(page)).toHaveText(new RegExp(`^Goal reached! ${goalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  await expect(goal).toContainText(/Reached on/)
  await expect.poll(async () => (await counts(page)).burst, { timeout: 5000 }).toBe(1)
  expect((await counts(page)).coin).toBe(2)
  await expect
    .poll(async () => (await server.goals(1, 'sv goal')).map((g) => Boolean(g.achievedAt)), {
      timeout: 60_000,
      intervals: [1000, 2000, 3000],
    })
    .toEqual([true])
  await dismissToast(page)

  // reload: persisted, and nothing is celebrated again
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: EN_OR_ES('Savings', 'Ahorros') })).toBeVisible()
  await recordMotion(page)
  await expect(page.locator('.sv-goal').filter({ hasText: goalName })).toContainText(/Reached on/)
  await expect(page.locator('.sv-row').filter({ hasText: noteFor('sv dep') })).toHaveCount(1)
  await page.waitForTimeout(2000)
  expect(await counts(page)).toEqual({ coin: 0, burst: 0 })

  // ---- a withdrawal: restrained, neutral ---------------------------------------------
  const before = await balanceCents(page)
  await fillMove(page, { kind: 'out', amount: '3000', note: noteFor('sv out') })
  await submit(page).click()
  await expect(sheet(page)).toHaveCount(0, { timeout: 30_000 })
  await expect(toastText(page)).toHaveText('You took ₡3.000 out of your savings')
  await expect(page.locator('.toast .success-check')).toHaveCount(0)
  await expect.poll(() => balanceCents(page), { timeout: 15_000 }).toBe(before - 300_000)
  expect(await counts(page)).toEqual({ coin: 1, burst: 0 })
  await expect
    .poll(async () => (await server.moves(1, 'sv out')).map((d) => [d.direction, d.amountCents]), {
      timeout: 60_000,
      intervals: [1000, 2000, 3000],
    })
    .toEqual([['out', 300_000]])
  await dismissToast(page)

  // a withdrawal above the balance is refused on screen and writes nothing
  await currencyTo(page, 'USD')
  await fillMove(page, { kind: 'out', amount: '999999999', note: noteFor('sv refused') })
  await expect(sheet(page).getByRole('alert')).toContainText(/You do not have that much in savings/)
  await submit(page).click()
  await expect(sheet(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)
  expect(await server.moves(1, 'sv refused')).toHaveLength(0)
  await currencyTo(page, 'CRC')

  // ---- offline: no answer from the server -> pending, no coin, no success ---------------
  await recordMotion(page)
  await context.setOffline(true)
  try {
    await fillMove(page, { kind: 'in', amount: '2000', note: noteFor('sv off') })
    await submit(page).click()
    await expect(sheet(page)).toHaveCount(0, { timeout: 30_000 })
    await expect(toastText(page)).toHaveText('It will be saved when you are back online')
    await expect(page.locator('.toast .success-check')).toHaveCount(0)
    await expect(page.locator('.sv-row').filter({ hasText: noteFor('sv off') })).toContainText('Waiting to sync')
    expect(await counts(page)).toEqual({ coin: 0, burst: 0 })
  } finally {
    await context.setOffline(false)
  }
  // the queued write reaches the server once, and only once
  await expect
    .poll(async () => (await server.moves(1, 'sv off')).length, { timeout: 90_000, intervals: [1000, 2000, 3000] })
    .toBe(1)
  await page.waitForTimeout(3000)
  expect(await server.moves(1, 'sv off')).toHaveLength(1)
  await dismissToast(page)

  // ---- delete the goal by name ----------------------------------------------------------
  await page.getByRole('button', { name: `Delete: ${goalName}` }).click()
  const dialog = page.locator('dialog.modal[open]')
  await expect(dialog).toContainText(goalName)
  await dialog.getByRole('button', { name: EN_OR_ES('Delete', 'Eliminar') }).click()
  await expect(page.locator('.sv-goal').filter({ hasText: goalName })).toHaveCount(0)
  await expect
    .poll(async () => (await server.goals(1, 'sv goal')).length, { timeout: 60_000, intervals: [1000, 2000, 3000] })
    .toBe(0)
})
