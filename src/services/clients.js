import { collection, doc, getDoc, onSnapshot, query, runTransaction, where } from 'firebase/firestore'
import { db } from '../config/firebase'
import { auditCreate, auditUpdate } from './firestore'
import { addVersion, versionRef } from './versions'
const ref = collection(db, 'clients')
const newestFirst = (items) => items.sort((left, right) => { const leftTime = left.updatedAt?.toMillis?.() || left.updatedAt?.seconds * 1000 || 0; const rightTime = right.updatedAt?.toMillis?.() || right.updatedAt?.seconds * 1000 || 0; return rightTime - leftTime })
export const subscribeClients = (uid, callback, error) => onSnapshot(query(ref, where('ownerId', '==', uid)), (snapshot) => callback(newestFirst(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))), error)
export const getClient = async (uid, id) => { const snapshot = await getDoc(doc(db, 'clients', id)); return snapshot.exists() && snapshot.data().ownerId === uid ? { id: snapshot.id, ...snapshot.data() } : null }
export const createClient = async (uid, values) => { const reference = doc(ref); const history = versionRef(); await runTransaction(db, async (tx) => { const after = { ...values, isDeleted: false, deletedAt: null, deletedBy: null }; tx.set(reference, auditCreate(uid, after)); addVersion(tx, history, uid, { entityType: 'Client', entityId: reference.id, action: 'Created', beforeSnapshot: {}, afterSnapshot: after }) }); return reference }
export const updateClient = async (uid, id, values) => { const reference = doc(db, 'clients', id); const history = versionRef(); await runTransaction(db, async (tx) => { const before = (await tx.get(reference)).data(); if (!before) throw new Error('Client not found.'); tx.update(reference, auditUpdate(uid, values)); addVersion(tx, history, uid, { entityType: 'Client', entityId: id, action: 'Updated', beforeSnapshot: before, afterSnapshot: { ...before, ...values } }) }) }
export const archiveClient = (uid, id) => updateClient(uid, id, { status: 'Archived' })
export const clientLookup = (clients) => Object.fromEntries(clients.map((client) => [client.id, client]))