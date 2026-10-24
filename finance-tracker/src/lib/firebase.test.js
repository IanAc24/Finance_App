import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// No network: firebase/app and firebase/auth are replaced by fakes
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn((config) => ({ config })),
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn((app) => ({ app })),
  onAuthStateChanged: vi.fn(() => () => {}),
  signInWithEmailAndPassword: vi.fn(async () => ({})),
  createUserWithEmailAndPassword: vi.fn(async () => ({})),
  sendPasswordResetEmail: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
}))

const VARIABLES = {
  VITE_FIREBASE_API_KEY: 'test-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.example.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: 'test-app',
}

const fullEnv = { ...VARIABLES }

// a fresh copy of the module, so the lazy start can be checked each time
async function load() {
  vi.resetModules()
  const firebaseApp = await import('firebase/app')
  const firebaseAuth = await import('firebase/auth')
  const module = await import('./firebase')
  return { module, firebaseApp, firebaseAuth }
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const [name, value] of Object.entries(VARIABLES)) vi.stubEnv(name, value)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('readFirebaseConfig', () => {
  it('reads the four settings', async () => {
    const { module } = await load()
    expect(module.readFirebaseConfig(fullEnv)).toEqual({
      apiKey: 'test-key',
      authDomain: 'test.example.com',
      projectId: 'test-project',
      appId: 'test-app',
    })
  })

  it('is null when any setting is missing or empty', async () => {
    const { module } = await load()
    for (const name of Object.keys(VARIABLES)) {
      expect(module.readFirebaseConfig({ ...fullEnv, [name]: undefined }), name).toBe(null)
      expect(module.readFirebaseConfig({ ...fullEnv, [name]: '  ' }), name).toBe(null)
    }
    expect(module.isFirebaseConfigured({})).toBe(false)
    expect(module.isFirebaseConfigured(fullEnv)).toBe(true)
  })
})

describe('isSignUpAllowed', () => {
  it('is on only with exactly "1"', async () => {
    const { module } = await load()
    expect(module.isSignUpAllowed({ VITE_ALLOW_SIGNUP: '1' })).toBe(true)
    for (const value of [undefined, '', '0', 'true', 'yes', ' 1']) {
      expect(module.isSignUpAllowed({ VITE_ALLOW_SIGNUP: value }), String(value)).toBe(false)
    }
  })
})

describe('Firebase start and actions', () => {
  it('does not start Firebase just by loading the file', async () => {
    const { firebaseApp } = await load()
    expect(firebaseApp.initializeApp).not.toHaveBeenCalled()
  })

  it('starts Firebase once, with the settings, on first use', async () => {
    const { module, firebaseApp, firebaseAuth } = await load()
    await module.signIn('ana@ejemplo.com', 'secreta1')
    await module.signOut()
    expect(firebaseApp.initializeApp).toHaveBeenCalledTimes(1)
    expect(firebaseApp.initializeApp).toHaveBeenCalledWith({
      apiKey: 'test-key',
      authDomain: 'test.example.com',
      projectId: 'test-project',
      appId: 'test-app',
    })
    expect(firebaseAuth.signOut).toHaveBeenCalledTimes(1)
  })

  it('fails clearly instead of starting without settings', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    const { module, firebaseApp } = await load()
    expect(() => module.signIn('ana@ejemplo.com', 'x')).toThrow('Firebase is not configured')
    expect(firebaseApp.initializeApp).not.toHaveBeenCalled()
  })

  it('trims the email but never the password', async () => {
    const { module, firebaseAuth } = await load()
    await module.signIn(' ana@ejemplo.com ', ' clave con espacios ')
    expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'ana@ejemplo.com',
      ' clave con espacios ',
    )
    await module.signUp(' ana@ejemplo.com', '12345678 ')
    expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'ana@ejemplo.com',
      '12345678 ',
    )
  })

  it('sends the reset email without custom link settings', async () => {
    const { module, firebaseAuth } = await load()
    await module.resetPassword(' ana@ejemplo.com ')
    expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      'ana@ejemplo.com',
    )
    expect(firebaseAuth.sendPasswordResetEmail.mock.calls[0]).toHaveLength(2)
  })

  it('passes the listener and returns the function that stops it', async () => {
    const { module, firebaseAuth } = await load()
    const stop = vi.fn()
    firebaseAuth.onAuthStateChanged.mockReturnValueOnce(stop)
    const onChange = vi.fn()
    const onError = vi.fn()
    expect(module.watchAuth(onChange, onError)).toBe(stop)
    expect(firebaseAuth.onAuthStateChanged).toHaveBeenCalledWith(expect.anything(), onChange, onError)
  })
})
