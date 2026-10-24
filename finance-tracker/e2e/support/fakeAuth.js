import { randomBytes } from 'node:crypto'

// A small in-memory FAKE of the Firebase Authentication REST backend
// (identitytoolkit + securetoken). It is a test double, not a bypass: the
// app's real Firebase SDK code runs unchanged and talks to this through
// Playwright's network interception. Nothing here touches a real project.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-max-age': '600',
}

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

// An unsigned JWT-shaped token with sub/email/exp claims
export function makeIdToken({ localId, email, expiresInSeconds }) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'none', typ: 'JWT' }
  const payload = {
    iss: 'https://securetoken.google.com/demo-qa',
    aud: 'demo-qa',
    auth_time: now,
    sub: localId,
    user_id: localId,
    iat: now,
    exp: now + expiresInSeconds,
    email,
    email_verified: false,
    firebase: { identities: { email: [email] }, sign_in_provider: 'password' },
  }
  return `${b64url(header)}.${b64url(payload)}.fake-signature`
}

function readToken(idToken) {
  try {
    return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString())
  } catch {
    return null
  }
}

function errorBody(message, code = 400) {
  return {
    error: { code, message, errors: [{ message, domain: 'global', reason: 'invalid' }] },
  }
}

// a deliberately strict check, like the server: needs a dot and a 2+ letter ending
const SERVER_EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

export class FakeAuth {
  constructor() {
    this.users = new Map() // email (lower case) -> user
    this.refreshTokens = new Map() // refresh token -> localId
    this.requests = [] // { service, op } of every auth call
    this.firestore = [] // Firestore requests (all answered 403)
    this.escaped = [] // requests that went to a non-local, non-Google host
    this.unhandled = [] // Google paths this fake does not implement
    this.sentResetEmails = []
    this.expiresIn = 3600 // seconds, of the ID tokens it issues
    this.forced = new Map() // op -> { message, status, times }
    // "protected" behaves as Firebase does today (always OK on reset);
    // "legacy" answers EMAIL_NOT_FOUND, to check the app does not leak it
    this.resetMode = 'protected'
    this.passwordPolicyCalls = 0
  }

  addUser(email, password) {
    const localId = randomBytes(14).toString('hex')
    const user = { localId, email, password, disabled: false, createdAt: Date.now() }
    this.users.set(email.toLowerCase(), user)
    return user
  }

  hasUser(email) {
    return this.users.has(email.toLowerCase())
  }

  deleteUser(email) {
    this.users.delete(email.toLowerCase())
  }

  disableUser(email) {
    const user = this.users.get(email.toLowerCase())
    if (user) user.disabled = true
  }

  // every refresh token stops working (the session was revoked/expired)
  revokeRefreshTokens() {
    this.refreshTokens.clear()
  }

  // The next `times` calls of `op` fail with this server message
  force(op, message, { status = 400, times = Infinity } = {}) {
    this.forced.set(op, { message, status, times })
  }

  clearForced(op) {
    this.forced.delete(op)
  }

  count(op) {
    return this.requests.filter((r) => r.op === op).length
  }

  // ---- requests -------------------------------------------------------

  issue(user) {
    const refreshToken = `rt-${randomBytes(16).toString('hex')}`
    this.refreshTokens.set(refreshToken, user.localId)
    return {
      idToken: makeIdToken({
        localId: user.localId,
        email: user.email,
        expiresInSeconds: this.expiresIn,
      }),
      refreshToken,
      expiresIn: String(this.expiresIn),
      localId: user.localId,
      email: user.email,
    }
  }

  takeForced(op) {
    const forced = this.forced.get(op)
    if (!forced || forced.times <= 0) return null
    forced.times -= 1
    return forced
  }

  // returns { status, body }
  handle(op, body) {
    this.requests.push({ service: 'auth', op })
    const forced = this.takeForced(op)
    if (forced) return { status: forced.status, body: errorBody(forced.message, forced.status) }

    switch (op) {
      case 'accounts:signUp': {
        const { email = '', password = '' } = body
        if (!SERVER_EMAIL.test(email)) return { status: 400, body: errorBody('INVALID_EMAIL') }
        if (password.length < 6) {
          return {
            status: 400,
            body: errorBody('WEAK_PASSWORD : Password should be at least 6 characters'),
          }
        }
        if (this.hasUser(email)) return { status: 400, body: errorBody('EMAIL_EXISTS') }
        const user = this.addUser(email, password)
        return {
          status: 200,
          body: { kind: 'identitytoolkit#SignupNewUserResponse', ...this.issue(user) },
        }
      }
      case 'accounts:signInWithPassword': {
        const { email = '', password = '' } = body
        if (!SERVER_EMAIL.test(email)) return { status: 400, body: errorBody('INVALID_EMAIL') }
        const user = this.users.get(email.toLowerCase())
        if (!user || user.password !== password) {
          return { status: 400, body: errorBody('INVALID_LOGIN_CREDENTIALS') }
        }
        if (user.disabled) return { status: 400, body: errorBody('USER_DISABLED') }
        return {
          status: 200,
          body: {
            kind: 'identitytoolkit#VerifyPasswordResponse',
            registered: true,
            displayName: '',
            ...this.issue(user),
          },
        }
      }
      case 'accounts:lookup': {
        const claims = readToken(body.idToken)
        const user = [...this.users.values()].find((u) => u.localId === claims?.sub)
        if (!user) return { status: 400, body: errorBody('USER_NOT_FOUND') }
        if (user.disabled) return { status: 400, body: errorBody('USER_DISABLED') }
        return {
          status: 200,
          body: {
            kind: 'identitytoolkit#GetAccountInfoResponse',
            users: [
              {
                localId: user.localId,
                email: user.email,
                emailVerified: false,
                passwordUpdatedAt: user.createdAt,
                providerUserInfo: [
                  {
                    providerId: 'password',
                    federatedId: user.email,
                    email: user.email,
                    rawId: user.email,
                  },
                ],
                validSince: String(Math.floor(user.createdAt / 1000)),
                lastLoginAt: String(Date.now()),
                createdAt: String(user.createdAt),
              },
            ],
          },
        }
      }
      case 'accounts:sendOobCode': {
        if (body.requestType !== 'PASSWORD_RESET') {
          return { status: 400, body: errorBody('INVALID_REQUEST_TYPE') }
        }
        const email = body.email ?? ''
        if (!SERVER_EMAIL.test(email)) return { status: 400, body: errorBody('INVALID_EMAIL') }
        if (this.hasUser(email)) this.sentResetEmails.push(email.toLowerCase())
        else if (this.resetMode === 'legacy') {
          return { status: 400, body: errorBody('EMAIL_NOT_FOUND') }
        }
        return { status: 200, body: { email } }
      }
      default:
        this.unhandled.push(op)
        return { status: 404, body: errorBody('NOT_FOUND', 404) }
    }
  }

  handleRefresh(form) {
    this.requests.push({ service: 'securetoken', op: 'token' })
    const forced = this.takeForced('token')
    if (forced) return { status: forced.status, body: errorBody(forced.message, forced.status) }
    const localId = this.refreshTokens.get(form.get('refresh_token'))
    const user = [...this.users.values()].find((u) => u.localId === localId)
    if (!user) return { status: 400, body: errorBody('INVALID_REFRESH_TOKEN') }
    if (user.disabled) return { status: 400, body: errorBody('USER_DISABLED') }
    const issued = this.issue(user)
    return {
      status: 200,
      body: {
        access_token: issued.idToken,
        expires_in: issued.expiresIn,
        token_type: 'Bearer',
        refresh_token: issued.refreshToken,
        id_token: issued.idToken,
        user_id: user.localId,
        project_id: 'demo-qa',
      },
    }
  }
}

// Routes every request of the context: local app -> through; Google hosts ->
// this fake (Firestore -> 403, recorded); anything else -> aborted and
// recorded as escaped (a test failure). Later routes win, so the catch-all
// goes first.
export async function installNetwork(context, fake) {
  const LOCAL = new Set(['localhost', '127.0.0.1'])

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (LOCAL.has(url.hostname)) return route.continue()
    fake.escaped.push(`${route.request().method()} ${url.origin}${url.pathname}`)
    return route.abort('blockedbyclient')
  })

  const json = (route, { status, body }) =>
    route.fulfill({
      status,
      headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    })

  const preflight = (route) => route.fulfill({ status: 204, headers: CORS })

  // any other Google API: recorded and refused (the specific routes below
  // are registered after this one, so they win)
  await context.route('**/*.googleapis.com/**', (route) => {
    const url = new URL(route.request().url())
    fake.escaped.push(`${route.request().method()} ${url.origin}${url.pathname} (other Google API)`)
    return route.abort('blockedbyclient')
  })

  // Firestore: never expected in local mode
  await context.route('**/firestore.googleapis.com/**', (route) => {
    const request = route.request()
    fake.firestore.push(`${request.method()} ${request.url().slice(0, 120)}`)
    if (request.method() === 'OPTIONS') return preflight(route)
    return json(route, { status: 403, body: errorBody('PERMISSION_DENIED', 403) })
  })

  await context.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return preflight(route)
    const url = new URL(request.url())
    const op = url.pathname.split('/').pop()
    if (op === 'passwordPolicy') {
      fake.passwordPolicyCalls += 1
      return json(route, { status: 404, body: errorBody('NOT_FOUND', 404) })
    }
    let body
    try {
      body = request.postDataJSON() ?? {}
    } catch {
      body = {}
    }
    return json(route, fake.handle(op, body))
  })

  await context.route('**/securetoken.googleapis.com/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return preflight(route)
    const form = new URLSearchParams(request.postData() ?? '')
    return json(route, fake.handleRefresh(form))
  })
}
