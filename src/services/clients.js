import { createRtdbRecord, getRtdbRecord, subscribeRtdbCollection, updateRtdbRecord } from './rtdbRecords'

export const subscribeClients = (uid, callback, error) => subscribeRtdbCollection(uid, 'clients', callback, error)
export const getClient = (uid, id) => getRtdbRecord(uid, 'clients', id)
export const createClient = (uid, values) => createRtdbRecord(uid, 'clients', 'Client', { ...values, isDeleted: false, deletedAt: null, deletedBy: null })
export const updateClient = (uid, id, values) => updateRtdbRecord(uid, 'clients', 'Client', id, values)
export const archiveClient = (uid, id) => updateClient(uid, id, { status: 'Archived' })
export const clientLookup = (clients) => Object.fromEntries(clients.map((client) => [client.id, client]))
