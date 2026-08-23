import { createRtdbRecord, getRtdbRecord, updateRtdbRecord } from './rtdbRecords'

export const COLLECTIONS = { SETTINGS: 'settings', MASTER_OPTIONS: 'masterOptions', CLIENTS: 'clients', PROJECTS: 'projects' }
export const withoutUndefined = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
export const auditCreate = (uid, value) => ({ ...withoutUndefined(value), ownerId: uid, ownerUid: uid, createdAt: Date.now(), updatedAt: Date.now(), createdBy: uid, updatedBy: uid })
export const auditUpdate = (uid, value) => ({ ...withoutUndefined(value), updatedAt: Date.now(), updatedBy: uid })

export async function saveGlobalSettings(uid, values) {
  const current = await getRtdbRecord(uid, 'settings', 'global')
  const next = withoutUndefined(values)
  if (current) return updateRtdbRecord(uid, 'settings', 'Settings', 'global', next)
  return createRtdbRecord(uid, 'settings', 'Settings', next, {}, 'global')
}

export const updateMasterOption = (id, uid, values) => updateRtdbRecord(uid, 'masterOptions', 'Master Data', id, values)

