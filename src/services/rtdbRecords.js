import { get, onValue, push, ref, runTransaction, update } from 'firebase/database'
import { rtdb } from '../config/firebase'

const database = () => {
  if (!rtdb) throw new Error('Realtime Database is not configured. Add the required environment variables and redeploy.')
  return rtdb
}
const root = (uid) => ref(database(), `users/${uid}`)
const itemRef = (uid, collection, id) => ref(database(), `users/${uid}/${collection}/${id}`)
export const toItems = (value) => Object.entries(value || {}).map(([id, data]) => ({ id, ...data }))
export const rtdbNow = () => Date.now()
export const newRtdbId = (uid, collection) => push(ref(database(), `users/${uid}/${collection}`)).key

const publicSnapshot = (value = {}) => Object.fromEntries(Object.entries(value).filter(([key]) => !/createdAt|updatedAt|createdBy|updatedBy|ownerId|ownerUid/i.test(key)))
const version = (uid, entityType, entityId, action, beforeSnapshot, afterSnapshot, related = {}) => ({
  ownerId: uid,
  ownerUid: uid,
  entityType,
  entityId,
  action,
  mutationId: entityId,
  schemaVersion: 1,
  beforeSnapshot: publicSnapshot(beforeSnapshot),
  afterSnapshot: publicSnapshot(afterSnapshot),
  changedFields: [...new Set([...Object.keys(beforeSnapshot || {}), ...Object.keys(afterSnapshot || {})])].filter((key) => JSON.stringify(beforeSnapshot?.[key]) !== JSON.stringify(afterSnapshot?.[key])),
  ...related,
  createdAt: rtdbNow(),
  actorUid: uid,
})

export function subscribeRtdbCollection(uid, collection, callback, onError, sortBy = 'updatedAt') {
  return onValue(ref(database(), `users/${uid}/${collection}`), (snapshot) => callback(toItems(snapshot.val()).sort((left, right) => (right[sortBy] || 0) - (left[sortBy] || 0))), onError)
}

export const subscribeRtdbFiltered = (uid, collection, predicate, callback, onError, sortBy = 'updatedAt') =>
  subscribeRtdbCollection(uid, collection, (items) => callback(items.filter(predicate)), onError, sortBy)

export async function getRtdbRecord(uid, collection, id) {
  const snapshot = await get(itemRef(uid, collection, id))
  if (!snapshot.exists()) return null
  const data = snapshot.val()
  return data.ownerId && data.ownerId !== uid ? null : { id, ...data }
}

export async function transactUserRoot(uid, mutation) {
  await runTransaction(root(uid), (current) => mutation(current || {}), { applyLocally: false })
}

export async function createRtdbRecord(uid, collection, entityType, fields, related = {}, fixedId) {
  const id = fixedId || newRtdbId(uid, collection)
  const now = rtdbNow()
  const record = { ...fields, ownerId: uid, ownerUid: uid, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid }
  const versionId = newRtdbId(uid, 'recordVersions')
  await update(root(uid), {
    [`${collection}/${id}`]: record,
    [`recordVersions/${versionId}`]: version(uid, entityType, id, 'Created', {}, record, related),
  })
  return { id }
}

export async function updateRtdbRecord(uid, collection, entityType, id, fields, related = {}) {
  const current = await getRtdbRecord(uid, collection, id)
  if (!current) throw new Error(`${entityType} not found.`)
  const now = rtdbNow()
  const next = { ...current, ...fields, updatedAt: now, updatedBy: uid }
  delete next.id
  const versionId = newRtdbId(uid, 'recordVersions')
  await update(root(uid), {
    [`${collection}/${id}`]: next,
    [`recordVersions/${versionId}`]: version(uid, entityType, id, 'Updated', current, next, related),
  })
  return { id }
}

