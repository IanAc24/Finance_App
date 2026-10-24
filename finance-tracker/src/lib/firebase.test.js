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

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn((app, settings) => ({ app, settings })),
  persistentLocalCache: vi.fn((options) => ({ kind: 'persistent', options })),
  persistentMultipleTabManager: vi.fn(() => ({ kind: 'tabs' })),
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
  it('is on by default, so anyone without an account can sign up', async () => {
    const { module } = await load()
    for (const value of [undefined, '', '1', 'true', 'yes']) {
      expect(module.isSignUpAllowed({ VITE_ALLOW_SIGNUP: value }), String(value)).toBe(true)
    }
    expect(module.isSignUpAllowed({})).toBe(true)
  })

  it('is off only with "0"', async () => {
    const { module } = await load()
    expect(module.isSignUpAllowed({ VITE_ALLOW_SIGNUP: '0' })).toBe(false)
    expect(module.isSignUpAllowed({ VITE_ALLOW_SIGNUP: ' 0 ' })).toBe(false)
  })
})

describe('isCloudData', () => {
  it('keeps each account in the cloud unless VITE_DATA_BACKEND is "local"', async () => {
    const { module } = await load()
    expect(module.isCloudData({})).toBe(true)
    expect(module.isCloudData({ VITE_DATA_BACKEND: 'cloud' })).toBe(true)
    expect(module.isCloudData({ VITE_DATA_BACKEND: 'local' })).toBe(false)
    expect(module.isCloudData({ VITE_DATA_BACKEND: ' local ' })).toBe(false)
  })
})

describe('getCloudDb', () => {
  it('starts Firestore once, on the same app, with a copy in the browser for every tab', async () => {
    const { module, firebaseApp } = await load()
    const firestore = await import('firebase/firestore')
    const db = module.getCloudDb()
    expect(module.getCloudDb()).toBe(db)
    expect(firestore.initializeFirestore).toHaveBeenCalledTimes(1)
    expect(firestore.persistentMultipleTabManager).toHaveBeenCalled()
    expect(db.settings.localCache.kind).toBe('persistent')
    module.signOut()
    expect(firebaseApp.initializeApp).toHaveBeenCalledTimes(1)
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

  it('sends Firebase emails in the language of the app', async () => {
    const { module, firebaseAuth } = await load()
    module.setAuthLanguage('es')
    const auth = firebaseAuth.getAuth.mock.results[0].value
    expect(auth.languageCode).toBe('es')
    module.setAuthLanguage('en')
    expect(auth.languageCode).toBe('en')
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
