import { collection, getDocs, getFirestore } from 'firebase/firestore'
import { get, ref, set } from 'firebase/database'
import { app, rtdb } from '../config/firebase'

const COLLECTIONS = ['appSettings', 'users', 'masterOptions', 'clients', 'projects', 'accounts', 'accountTransfers', 'income', 'expenses', 'recurringExpenseTemplates', 'projectDocuments', 'credentials', 'credentialVaultConfigs', 'notificationPreferences', 'notificationStates', 'recordVersions']

function serialize(value) {
  if (value == null || typeof value !== 'object') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (Array.isArray(value)) return value.map(serialize)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
}

function belongsToAdmin(value, uid) {
  return (!value.ownerId && !value.ownerUid) || value.ownerId === uid || value.ownerUid === uid
}

function destinationFor(name, itemId) {
  if (name === 'appSettings' && itemId === 'global') return ['settings', 'global']
  if (name === 'credentialVaultConfigs') return ['credentialVaultConfigs', 'global']
  if (name === 'users') return null
  return [name, itemId]
}

export async function migrateFirestoreToRealtimeDatabase(uid, { onProgress } = {}) {
  if (!app || !rtdb) throw new Error('Firebase migration services are not configured.')
  const firestore = getFirestore(app)
  const destination = ref(rtdb, `users/${uid}`)
  const existing = await get(destination)
  if (existing.exists()) throw new Error('Realtime Database already contains data. Migration was not run again.')

  const payload = { migration: { source: 'cloud-firestore', migratedAt: Date.now(), migratedBy: uid, schemaVersion: 2 } }
  let copied = 0
  for (const name of COLLECTIONS) {
    const snapshot = await getDocs(collection(firestore, name))
    snapshot.docs.forEach((item) => {
      const data = serialize(item.data())
      if (!(name === 'appSettings' || name === 'users' || belongsToAdmin(data, uid))) return
      const path = destinationFor(name, item.id)
      if (!path) return
      let cursor = payload
      path.forEach((segment, index) => {
        if (index === path.length - 1) cursor[segment] = data
        else cursor = cursor[segment] ||= {}
      })
      copied += 1
    })
    onProgress?.({ collection: name, copied })
  }
  await set(destination, payload)
  return { copied, collections: COLLECTIONS.length }
}

