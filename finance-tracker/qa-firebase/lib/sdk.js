import { deleteApp, initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  initializeFirestore,
  memoryLocalCache,
  query,
  setLogLevel,
  terminate,
  where,
  writeBatch,
} from 'firebase/firestore'
import { maskEmail, maskUid, tagOf } from './env.js'
import * as tracker from './tracker.js'

// Real, client-authenticated Firebase access for the QA suite: the same web
// SDK the app uses, with a signed-in test account (never an admin key). It
// only ever SIGNS IN: accounts are created by a person in the console.

setLogLevel('silent')

export const COLLECTIONS = ['transactions', 'categories', 'budgets', 'recurring', 'savings', 'meta']

let instance = 0

// A separate app instance (own auth state, own memory cache). `account` null
// gives an instance that is not signed in.
export async function makeClient(cfg, account) {
  instance += 1
  const app = initializeApp(cfg.firebaseConfig, `qa-${account?.n ?? 'anon'}-${instance}`)
  const auth = getAuth(app)
  const db = initializeFirestore(app, { localCache: memoryLocalCache() })
  let uid = null
  if (account) {
    try {
      const cred = await signInWithEmailAndPassword(auth, account.email, account.password)
      uid = cred.user.uid
    } catch (error) {
      await deleteApp(app).catch(() => {})
      // the code only: never the address or the password
      throw new Error(
        `Could not sign in account #${account.n} (${maskEmail(account.email)}): ${error?.code ?? 'unknown error'}. ` +
          'Create it in the console (Authentication > Users > Add user) and check the password.',
        { cause: error },
      )
    }
  }
  return {
    n: account?.n ?? null,
    uid,
    db,
    auth,
    app,
    path: (...parts) => ['users', uid, ...parts],
    async close() {
      try {
        if (account) await signOut(auth)
      } catch {
        // already gone
      }
      await terminate(db).catch(() => {})
      await deleteApp(app).catch(() => {})
    },
  }
}

// True if the document carries this run's tag in note, name or qaTag
export function hasTag(data, tag) {
  return ['note', 'name', 'qaTag'].some((f) => typeof data?.[f] === 'string' && data[f].startsWith(tag))
}

// Documents of `name` whose note starts with `prefix` (server read, a single
// field range, so no index has to be created)
export async function taggedDocs(client, name, prefix) {
  const q = query(
    collection(client.db, ...client.path(name)),
    where('note', '>=', prefix),
    where('note', '<', `${prefix}`),
  )
  const snap = await getDocsFromServer(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

const SWEEP = ['transactions', 'savings', 'recurring']

// Removes what this run created, signing in as each account that took part:
//   1. every document registered in the manifest, but only if it carries the
//      run tag (anything else is left alone and reported);
//   2. every transaction / saving / recurring item whose note starts with the
//      tag (the ones the app itself created through the screens).
// Idempotent: running it again finds nothing. Deletions are counted but never
// blocked by the write cap.
export async function teardown(cfg, log = console.log) {
  const state = tracker.snapshot()
  if (!state || state.runId !== cfg.runId) {
    log('Teardown: no manifest for this run, nothing to remove.')
    return { removed: 0, skipped: 0, failures: [] }
  }
  const tag = tagOf(cfg.runId)
  let removed = 0
  let skipped = 0
  const failures = []

  for (const n of state.accounts) {
    const account = cfg.account(n)
    if (!account) {
      failures.push(`account #${n} is no longer configured`)
      continue
    }
    let client
    try {
      client = await makeClient(cfg, account)
    } catch (error) {
      failures.push(error.message)
      continue
    }
    try {
      for (const d of state.docs.filter((x) => x.n === n)) {
        try {
          const ref = doc(client.db, ...client.path(d.collection, d.id))
          const snap = await getDocFromServer(ref)
          if (!snap.exists()) {
            tracker.untrack(cfg.runId, n, d.collection, d.id)
            continue
          }
          if (!hasTag(snap.data(), tag)) {
            skipped += 1
            log(`  left alone (no run tag): #${n} ${d.collection}/${d.id}`)
            continue
          }
          await deleteDoc(ref)
          tracker.countDeletes(cfg.runId, 1)
          tracker.untrack(cfg.runId, n, d.collection, d.id)
          removed += 1
        } catch (error) {
          failures.push(`#${n} ${d.collection}/${d.id}: ${error?.code ?? error?.message}`)
        }
      }
      for (const name of SWEEP) {
        try {
          const found = await taggedDocs(client, name, tag)
          for (let i = 0; i < found.length; i += 400) {
            const batch = writeBatch(client.db)
            const part = found.slice(i, i + 400)
            for (const f of part) {
              // double check right before deleting
              if (hasTag(f, tag)) batch.delete(doc(client.db, ...client.path(name, f.id)))
            }
            await batch.commit()
            tracker.countDeletes(cfg.runId, part.length)
            removed += part.length
          }
        } catch (error) {
          failures.push(`#${n} sweep of ${name} (${maskUid(client.uid)}): ${error?.code ?? error?.message}`)
        }
      }
    } finally {
      await client.close()
    }
  }
  log(`Teardown: ${removed} document(s) removed, ${skipped} left alone, ${failures.length} failure(s).`)
  for (const f of failures) log(`  FAILED ${f}`)
  return { removed, skipped, failures }
}
