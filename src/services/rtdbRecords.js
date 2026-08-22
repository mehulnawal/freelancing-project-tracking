import { get, onValue, push, ref, update } from 'firebase/database'
import { rtdb } from '../config/firebase'

const root = (uid) => ref(rtdb, `users/${uid}`)
const itemRef = (uid, collection, id) => ref(rtdb, `users/${uid}/${collection}/${id}`)
const toItems = (value) => Object.entries(value || {}).map(([id, data]) => ({ id, ...data }))
const timestamp = () => Date.now()
const publicSnapshot = (value = {}) => Object.fromEntries(Object.entries(value).filter(([key]) => !/createdAt|updatedAt|createdBy|updatedBy|ownerId|ownerUid/i.test(key)))
const version = (uid, entityType, entityId, action, beforeSnapshot, afterSnapshot, related = {}) => ({ ownerId: uid, ownerUid: uid, entityType, entityId, action, mutationId: entityId, schemaVersion: 1, beforeSnapshot: publicSnapshot(beforeSnapshot), afterSnapshot: publicSnapshot(afterSnapshot), changedFields: [...new Set([...Object.keys(beforeSnapshot || {}), ...Object.keys(afterSnapshot || {})])].filter((key) => JSON.stringify(beforeSnapshot?.[key]) !== JSON.stringify(afterSnapshot?.[key])), ...related, createdAt: timestamp(), actorUid: uid })

export function subscribeRtdbCollection(uid, collection, callback, onError, sortBy = 'updatedAt') {
  return onValue(ref(rtdb, `users/${uid}/${collection}`), (snapshot) => callback(toItems(snapshot.val()).sort((left, right) => (right[sortBy] || 0) - (left[sortBy] || 0))), onError)
}

export async function getRtdbRecord(uid, collection, id) {
  const snapshot = await get(itemRef(uid, collection, id))
  if (!snapshot.exists()) return null
  const data = snapshot.val()
  return data.ownerId && data.ownerId !== uid ? null : { id, ...data }
}

export async function createRtdbRecord(uid, collection, entityType, fields, related = {}) {
  const id = push(ref(rtdb, `users/${uid}/${collection}`)).key
  const now = timestamp()
  const record = { ...fields, ownerId: uid, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid }
  const versionId = push(ref(rtdb, `users/${uid}/recordVersions`)).key
  await update(root(uid), { [`${collection}/${id}`]: record, [`recordVersions/${versionId}`]: version(uid, entityType, id, 'Created', {}, record, related) })
  return { id }
}

export async function updateRtdbRecord(uid, collection, entityType, id, fields, related = {}) {
  const current = await getRtdbRecord(uid, collection, id)
  if (!current) throw new Error(`${entityType} not found.`)
  const now = timestamp()
  const next = { ...current, ...fields, id: undefined, updatedAt: now, updatedBy: uid }
  delete next.id
  const versionId = push(ref(rtdb, `users/${uid}/recordVersions`)).key
  await update(root(uid), { [`${collection}/${id}`]: next, [`recordVersions/${versionId}`]: version(uid, entityType, id, 'Updated', current, next, related) })
  return { id }
}
