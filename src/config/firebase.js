import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const keys = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID']
const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID }
export const isFirebaseConfigured = keys.every((key) => Boolean(import.meta.env[key]))
export const isDevelopmentPreview = Boolean(import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_PREVIEW === 'true')
const cacheEnabled = localStorage.getItem('fm-trusted-offline-cache') === 'true'
let app; let auth; let db
if (isFirebaseConfigured) {
  app = getApps()[0] || initializeApp(config)
  auth = getAuth(app)
  try { db = initializeFirestore(app, cacheEnabled ? { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) } : { localCache: memoryLocalCache() }) } catch { db = getFirestore(app) }
}
export { app, auth, db, cacheEnabled }
