import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'

const SENSITIVE = /password|passphrase|secret|token|api.?key|credentialfields|plaintext|decrypted|vaultkey|recovery|pin/i
const AUDIT = /createdAt|updatedAt|createdBy|updatedBy|ownerId|ownerUid/i
const plain = (value) => {
  if (value?.toDate) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE.test(key) ? '[redacted]' : plain(item)]))
  return value
}
export const safeSnapshot = (value) => Object.fromEntries(Object.entries(plain(value || {})).filter(([key]) => !AUDIT.test(key)))
export const changedFields = (before = {}, after = {}) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]) && !SENSITIVE.test(key))
export const versionRef = () => doc(collection(db, 'recordVersions'))
export const addVersion = (transaction, reference, uid, { entityType, entityId, action, beforeSnapshot, afterSnapshot, related = {}, mutationId = reference.id }) => transaction.set(reference, {
  ownerId: uid, ownerUid: uid, entityType, entityId, action, mutationId, schemaVersion: 1,
  beforeSnapshot: safeSnapshot(beforeSnapshot), afterSnapshot: safeSnapshot(afterSnapshot), changedFields: changedFields(beforeSnapshot, afterSnapshot),
  ...related, createdAt: new Date(), actorUid: uid,
})
export const subscribeVersions = (uid, callback, onError) => onSnapshot(query(collection(db, 'recordVersions'), where('ownerId', '==', uid), orderBy('createdAt', 'desc')), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError)
export const isFinancialEntity = (type) => ['Account', 'Transfer', 'Income', 'Project Payment', 'Expense'].includes(type)
