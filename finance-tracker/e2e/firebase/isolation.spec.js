import { expectInApp, expectSignInScreen, goTo, signOut, fillSignIn, passConsentAndWelcome } from '../support/app.js'
import { addTagged, enterAs, expect, noteFor, onlyWhenEnabled, qa, reserveWrites, taggedRows, test } from './fb.js'

// Two real accounts never see each other's data.
onlyWhenEnabled()

async function historyHas(page, label) {
  await goTo(page, 'history')
  return (await taggedRows(page, label)).length
}

test('two browsers, accounts 1 and 2 at the same time: each sees only its own rows', async ({ newContext, server }) => {
  reserveWrites(2)
  const [ctxA, ctxB] = [await newContext(), await newContext()]
  const [pageA, pageB] = [await ctxA.newPage(), await ctxB.newPage()]
  await Promise.all([enterAs(pageA, 1), enterAs(pageB, 2)])

  await addTagged(pageA, 'iso A', { amount: '1111' })
  await addTagged(pageB, 'iso B', { amount: '2222' })

  for (const [page, mine, theirs] of [
    [pageA, 'iso A', 'iso B'],
    [pageB, 'iso B', 'iso A'],
  ]) {
    await expect.poll(() => historyHas(page, mine)).toBe(1)
    expect(await historyHas(page, theirs)).toBe(0)
    await page.reload()
    await expectInApp(page)
    await expect.poll(() => historyHas(page, mine)).toBe(1)
    expect(await historyHas(page, theirs)).toBe(0)
    expect(await page.locator('body').innerText()).not.toContain(noteFor(theirs))
  }

  // and the server agrees
  expect(await server.docs(1, 'iso A')).toHaveLength(1)
  expect(await server.docs(1, 'iso B')).toHaveLength(0)
  expect(await server.docs(2, 'iso B')).toHaveLength(1)
  expect(await server.docs(2, 'iso A')).toHaveLength(0)
})

test('sign out account 1, sign in account 2 in the same browser: nothing of account 1 is left on screen', async ({ page }) => {
  reserveWrites(2)
  await enterAs(page, 1)
  await addTagged(page, 'switch A', { amount: '3333' })
  await expect.poll(() => historyHas(page, 'switch A')).toBe(1)

  await signOut(page)
  await expectSignInScreen(page)
  const b = qa().account(2)
  await fillSignIn(page, b.email, b.password)
  await passConsentAndWelcome(page)

  const mustNotShowA = async (where) => {
    await goTo(page, where)
    await expect(page.locator('body')).not.toContainText(noteFor('switch A'))
    await expect(page.getByText(noteFor('switch A'))).toHaveCount(0)
  }
  await mustNotShowA('home')
  await mustNotShowA('history')
  await mustNotShowA('stats')
  expect(await taggedRows(page, 'switch A')).toHaveLength(0)

  // account 2 saves its own row and still sees only that one
  await addTagged(page, 'switch B', { amount: '4444' })
  await expect.poll(() => historyHas(page, 'switch B')).toBe(1)
  expect(await historyHas(page, 'switch A')).toBe(0)
  await page.reload()
  await expectInApp(page)
  expect(await historyHas(page, 'switch A')).toBe(0)

  // back to account 1: its row is there, account 2's is not
  await signOut(page)
  const a = qa().account(1)
  await fillSignIn(page, a.email, a.password)
  await passConsentAndWelcome(page)
  await expect.poll(() => historyHas(page, 'switch A')).toBe(1)
  expect(await historyHas(page, 'switch B')).toBe(0)
})
