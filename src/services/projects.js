import { createRtdbRecord, getRtdbRecord, subscribeRtdbCollection, updateRtdbRecord } from './rtdbRecords'

export const subscribeProjects = (uid, callback, error) => subscribeRtdbCollection(uid, 'projects', callback, error)
export const getProject = (uid, id) => getRtdbRecord(uid, 'projects', id)
export const createProject = (uid, values) => createRtdbRecord(uid, 'projects', 'Project', { ...values, isDeleted: false, deletedAt: null, deletedBy: null }, { clientId: values.clientId })
export const updateProject = async (uid, id, values) => { const current = await getProject(uid, id); if (!current) throw new Error('Project not found.'); return updateRtdbRecord(uid, 'projects', 'Project', id, values, { clientId: values.clientId || current.clientId }) }
export const archiveProject = (uid, id) => updateProject(uid, id, { status: 'Archived' })
