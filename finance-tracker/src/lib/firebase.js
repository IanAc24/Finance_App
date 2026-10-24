import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Firebase: Authentication (email and password) and Firestore (each
// account's data, see db/cloudStorage.js). The settings come from the
// VITE_FIREBASE_* variables in .env.local, read when the app is built; the
// values are never in the repository.

const CONFIG_VARIABLES = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}

// The Firebase settings, or null if any variable is missing or empty
export function readFirebaseConfig(env = import.meta.env) {
  const config = {}
  for (const [field, name] of Object.entries(CONFIG_VARIABLES)) {
    const value = typeof env[name] === 'string' ? env[name].trim() : ''
    if (!value) return null
    config[field] = value
  }
  return config
}

export function isFirebaseConfigured(env = import.meta.env) {
  return readFirebaseConfig(env) !== null
}

// Anyone without an account can create one from the app. VITE_ALLOW_SIGNUP
// set to "0" turns that off (accounts are then made in the Firebase console).
export function isSignUpAllowed(env = import.meta.env) {
  return env.VITE_ALLOW_SIGNUP?.trim() !== '0'
}

// Where each account's data lives: in the cloud (Firestore) unless
// VITE_DATA_BACKEND is "local", which goes back to the one SQLite database of
// this device (every account then shares it, as before)
export function isCloudData(env = import.meta.env) {
  return env.VITE_DATA_BACKEND?.trim() !== 'local'
}

// Firebase starts the first time it is needed, not when the file is loaded
let app = null
let auth = null
let firestore = null

function getFirebaseApp() {
  if (!app) {
    const config = readFirebaseConfig()
    if (!config) throw new Error('Firebase is not configured')
    app = initializeApp(config)
  }
  return app
}

function getFirebaseAuth() {
  if (!auth) auth = getAuth(getFirebaseApp())
  return auth
}

// Firestore keeps a copy of the account's data in the browser (IndexedDB),
// shared by the open tabs: the app opens and saves without internet and
// sends the changes when it is back
export function getCloudDb() {
  if (!firestore) {
    firestore = initializeFirestore(getFirebaseApp(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  }
  return firestore
}

// Calls onChange with the signed-in user (or null) now and on every change.
// Returns the function that stops listening.
export function watchAuth(onChange, onError) {
  return onAuthStateChanged(getFirebaseAuth(), onChange, onError)
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
}

export function signUp(email, password) {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
}

// No custom link settings: Firebase's own page sets the new password
export function resetPassword(email) {
  return sendPasswordResetEmail(getFirebaseAuth(), email.trim())
}

// Emails from Firebase (the password reset link) in the app's language
export function setAuthLanguage(lang) {
  getFirebaseAuth().languageCode = lang
}

export function signOut() {
  return firebaseSignOut(getFirebaseAuth())
}
