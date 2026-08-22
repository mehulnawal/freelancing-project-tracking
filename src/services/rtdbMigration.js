import { collection, getDocs } from 'firebase/firestore'
import { get, ref, set } from 'firebase/database'
import { db, rtdb } from '../config/firebase'

const COLLECTIONS = ['appSettings', 'users', 'masterOptions', 'clients', 'projects', 'accounts', 'accountTransfers', 'income', 'expenses', 'recurringExpenseTemplates', 'projectDocuments', 'credentials', 'credentialVaultConfigs', 'notificationPreferences', 'notificationStates', 'recordVersions']

function serialize(value) {
  if (value == null || typeof value !== 'object') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (Array.isArray(value)) return value.map(serialize)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
}

function belongsToAdmin(value, uid) {
  return !value.ownerId && !value.ownerUid || value.ownerId === uid || value.ownerUid === uid
}

export async function migrateFirestoreToRealtimeDatabase(uid, { onProgress } = {}) {
  if (!rtdb) throw new Error('Realtime Database is not configured.')
  const destination = ref(rtdb, `users/${uid}`)
  const existing = await get(destination)
  if (existing.exists()) throw new Error('Realtime Database already contains migrated data. Migration was not run again.')

  const payload = { migration: { source: 'cloud-firestore', migratedAt: Date.now(), migratedBy: uid, schemaVersion: 1 } }
  let copied = 0
  for (const name of COLLECTIONS) {
    const snapshot = await getDocs(collection(db, name))
    const entries = {}
    snapshot.docs.forEach((item) => {
      const data = serialize(item.data())
      if (name === 'appSettings' || name === 'users' || belongsToAdmin(data, uid)) {
        entries[item.id] = data
        copied += 1
      }
    })
    payload[name] = entries
    onProgress?.({ collection: name, copied })
  }
  await set(destination, payload)
  return { copied, collections: COLLECTIONS.length }
}
