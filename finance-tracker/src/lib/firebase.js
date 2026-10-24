import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'

// Firebase Authentication (email and password). The settings come from the
// VITE_FIREBASE_* variables in .env.local, read when the app is built; the
// values are never in the repository. Only sign-in lives here: the data is
// still in the local SQLite database.

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

// Firebase starts the first time it is needed, not when the file is loaded
let auth = null

function getFirebaseAuth() {
  if (!auth) {
    const config = readFirebaseConfig()
    if (!config) throw new Error('Firebase is not configured')
    auth = getAuth(initializeApp(config))
  }
  return auth
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
