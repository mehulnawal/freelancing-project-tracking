import { getRtdbRecord, newRtdbId, rtdbNow, subscribeRtdbCollection, transactUserRoot } from './rtdbRecords'
import { clientDuplicateReason, normalizeEmail, normalizeName, normalizePhone } from '../utils/normalization'

function cleanClient(values) {
  return {
    ...values,
    name: String(values.name || '').trim().replace(/\s+/g, ' '),
    normalizedName: normalizeName(values.name),
    email: normalizeEmail(values.email) || null,
    mobile: String(values.mobile || '').trim() || null,
    phone: String(values.phone || '').trim() || null,
    normalizedPhone: normalizePhone(values.mobile || values.phone) || null,
  }
}

function assertClient(values) {
  if (!values.name) throw new Error('Client name is required.')
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw new Error('Enter a valid client email.')
  if (values.normalizedPhone && values.normalizedPhone.length < 6) throw new Error('Enter a valid client phone number.')
}

export const subscribeClients = (uid, cb, error) => subscribeRtdbCollection(uid, 'clients', cb, error)
export const getClient = (uid, id) => getRtdbRecord(uid, 'clients', id)

export async function createClient(uid, values) {
  const client = cleanClient(values)
  assertClient(client)
  const id = newRtdbId(uid, 'clients')
  const now = rtdbNow()
  await transactUserRoot(uid, (state) => {
    const duplicate = clientDuplicateReason(state.clients, client)
    if (duplicate) throw new Error(duplicate)
    state.clients ||= {}
    state.clients[id] = { ...client, id, isDeleted: false, deletedAt: null, deletedBy: null, ownerId: uid, ownerUid: uid, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid }
    return state
  })
  return { id }
}

export async function updateClient(uid, id, values) {
  const now = rtdbNow()
  await transactUserRoot(uid, (state) => {
    const current = state.clients?.[id]
    if (!current) throw new Error('Client not found.')
    const client = cleanClient({ ...current, ...values })
    assertClient(client)
    const duplicate = clientDuplicateReason(state.clients, client, id)
    if (duplicate) throw new Error(duplicate)
    state.clients[id] = { ...current, ...client, id, updatedAt: now, updatedBy: uid }
    return state
  })
  return { id }
}

export const archiveClient = (uid, id) => updateClient(uid, id, { status: 'Archived' })
export const clientLookup = (clients) => Object.fromEntries(clients.map((item) => [item.id, item]))

