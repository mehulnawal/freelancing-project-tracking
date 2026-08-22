import { collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, where } from 'firebase/firestore'
import { db } from '../config/firebase'
import { auditCreate, auditUpdate } from './firestore'
import { addVersion, versionRef } from './versions'
const ref = collection(db, 'clients')
export const subscribeClients = (uid, callback, error) => onSnapshot(query(ref, where('ownerId', '==', uid), orderBy('updatedAt', 'desc')), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), error)
export const getClient = async (uid, id) => { const items = await getDocs(query(ref, where('ownerId', '==', uid), where('__name__', '==', id))); return items.docs[0] ? { id: items.docs[0].id, ...items.docs[0].data() } : null }
export const createClient = async (uid, values) => { const reference = doc(ref); const history = versionRef(); await runTransaction(db, async (tx) => { const after = { ...values, isDeleted: false, deletedAt: null, deletedBy: null }; tx.set(reference, auditCreate(uid, after)); addVersion(tx, history, uid, { entityType: 'Client', entityId: reference.id, action: 'Created', beforeSnapshot: {}, afterSnapshot: after }) }); return reference }
export const updateClient = async (uid, id, values) => { const reference = doc(db, 'clients', id); const history = versionRef(); await runTransaction(db, async (tx) => { const before = (await tx.get(reference)).data(); if (!before) throw new Error('Client not found.'); tx.update(reference, auditUpdate(uid, values)); addVersion(tx, history, uid, { entityType: 'Client', entityId: id, action: 'Updated', beforeSnapshot: before, afterSnapshot: { ...before, ...values } }) }) }
export const archiveClient = (uid, id) => updateClient(uid, id, { status: 'Archived' })
export const clientLookup = (clients) => Object.fromEntries(clients.map((client) => [client.id, client]))