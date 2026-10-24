import { expectInApp, goTo } from '../support/app.js'
import { makeRng } from '../support/seed.js'
import {
  addTagged,
  enterAs,
  expect,
  onlyWhenEnabled,
  parseMoney,
  qa,
  reserveWrites,
  sumCents,
  taggedRows,
  test,
  waitForServer,
} from './fb.js'
import { writesLeft } from '../../qa-firebase/lib/tracker.js'

// Writes through the real screens against the real project (account 1).
// Every row is tagged "QA-<runId> <label>" and removed by teardown.
onlyWhenEnabled()

async function rowsOf(page, label) {
  await goTo(page, 'history')
  return taggedRows(page, label)
}

test('saving five times in a row creates one row', async ({ page, server }) => {
  reserveWrites(1)
  await enterAs(page, 1)
  await addTagged(page, 'rapid', { amount: '777', save: false })
  // five clicks in the same instant, before the screen can react
  await page.evaluate(() => {
    const button = document.querySelector('button.save-key')
    for (let i = 0; i < 5; i++) button.click()
  })
  await expect(page.locator('.toast-message')).toBeVisible()
  await waitForServer(server, 1, 'rapid', (d) => d.length >= 1)
  await page.waitForTimeout(3000) // a late duplicate would show up now
  expect(await server.docs(1, 'rapid')).toHaveLength(1)
  expect(await rowsOf(page, 'rapid')).toHaveLength(1)
})

test('saving while offline, then back online: the row persists exactly once', async ({ page, context, server }) => {
  reserveWrites(1)
  await enterAs(page, 1)
  await goTo(page, 'history')
  await context.setOffline(true)
  try {
    await addTagged(page, 'offline', { amount: '888' })
    // visible from the local copy while offline
    await expect.poll(async () => (await rowsOf(page, 'offline')).length).toBe(1)
  } finally {
    await context.setOffline(false)
  }
  // Firestore sends the queued write once the connection is back
  await waitForServer(server, 1, 'offline', (d) => d.length === 1 && d[0].amountCents === 88800, 90_000)
  await page.waitForTimeout(3000)
  expect(await server.docs(1, 'offline')).toHaveLength(1)
  await page.reload()
  await expectInApp(page)
  expect(await rowsOf(page, 'offline')).toHaveLength(1)
})

test('colones and dollars stay apart: ₡10.000 and $100', async ({ page, server }) => {
  reserveWrites(2)
  await enterAs(page, 1)
  await addTagged(page, 'cur crc', { amount: '10000', currency: 'CRC' })
  await addTagged(page, 'cur usd', { amount: '100', currency: 'USD' })

  const check = async () => {
    const crc = await rowsOf(page, 'cur crc')
    const usd = await rowsOf(page, 'cur usd')
    expect(crc).toHaveLength(1)
    expect(usd).toHaveLength(1)
    expect(parseMoney(crc[0].amount)).toEqual({ currency: 'CRC', cents: 1_000_000 })
    expect(parseMoney(usd[0].amount)).toEqual({ currency: 'USD', cents: 10_000 })
    expect(crc[0].amount.replace(/\s/g, '')).toContain('₡10.000')
    expect(usd[0].amount.replace(/\s/g, '')).toContain('$100')
  }
  await check()
  await waitForServer(server, 1, 'cur crc', (d) => d.length === 1 && d[0].currency === 'CRC' && d[0].amountCents === 1_000_000)
  await waitForServer(server, 1, 'cur usd', (d) => d.length === 1 && d[0].currency === 'USD' && d[0].amountCents === 10_000)
  await page.reload()
  await expectInApp(page)
  await check()
})

// 100 x $0.10 = $10.00 exactly. It costs 100 writes of QA_MAX_WRITES; when the
// cap leaves less than that (plus room for the next test), it falls back to
// 20 x $0.50 = $10.00 (20 writes). The choice is printed in the test output.
test('many small dollar amounts add up exactly to $10.00', async ({ page, server }, testInfo) => {
  test.setTimeout(900_000)
  const room = writesLeft(qa().runId)
  const many = room >= 100 + 30
  const count = many ? 100 : 20
  const amount = many ? '0.10' : '0.50'
  const unitCents = many ? 10 : 50
  testInfo.annotations.push({ type: 'choice', description: `${count} x $${amount} (${room} writes left of the cap)` })
  console.log(`[qa:firebase] small amounts: ${count} x $${amount}`)
  reserveWrites(count)
  await enterAs(page, 1)
  for (let i = 0; i < count; i++) {
    await addTagged(page, `small ${String(i).padStart(3, '0')}`, { amount, currency: 'USD' })
  }
  const rows = await rowsOf(page, 'small')
  expect(rows).toHaveLength(count)
  expect(sumCents(rows, 'USD')).toBe(1000)
  await expect
    .poll(async () => (await server.docs(1, 'small')).length, { timeout: 60_000 })
    .toBe(count)
  const docs = await server.docs(1, 'small')
  expect(docs.every((d) => d.currency === 'USD' && d.amountCents === unitCents)).toBe(true)
  expect(docs.reduce((s, d) => s + d.amountCents, 0)).toBe(1000)
  await page.reload()
  await expectInApp(page)
  expect(sumCents(await rowsOf(page, 'small'), 'USD')).toBe(1000)
})

test('20 seeded random transactions match independent totals', async ({ page, server }) => {
  reserveWrites(20)
  const rng = makeRng(`firebase:${qa().runId}`)
  const items = Array.from({ length: 20 }, (_, i) => {
    const usd = rng() < 0.5
    const cents = usd ? 1 + Math.floor(rng() * 20000) : (1 + Math.floor(rng() * 50000)) * 100
    return { label: `rand ${String(i).padStart(2, '0')}`, currency: usd ? 'USD' : 'CRC', cents }
  })
  // independent expectation, in integer cents per currency
  const expected = { CRC: 0, USD: 0 }
  for (const it of items) expected[it.currency] += it.cents

  await enterAs(page, 1)
  for (const it of items) {
    const text = it.currency === 'USD' ? (it.cents / 100).toFixed(2) : String(it.cents / 100)
    await addTagged(page, it.label, { amount: text, currency: it.currency })
  }

  const rows = await rowsOf(page, 'rand')
  expect(rows).toHaveLength(20)
  for (const code of ['CRC', 'USD']) expect(sumCents(rows, code), `screen total ${code}`).toBe(expected[code])

  await expect.poll(async () => (await server.docs(1, 'rand')).length, { timeout: 60_000 }).toBe(20)
  const docs = await server.docs(1, 'rand')
  for (const code of ['CRC', 'USD']) {
    const total = docs.filter((d) => d.currency === code).reduce((s, d) => s + d.amountCents, 0)
    expect(total, `server total ${code}`).toBe(expected[code])
  }
})
