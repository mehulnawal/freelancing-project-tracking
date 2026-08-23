import { get, ref, update } from 'firebase/database'
import { rtdb } from '../config/firebase'
import { MASTER_DEFAULTS } from '../constants/masterOptions'
import { newRtdbId, rtdbNow, transactUserRoot, updateRtdbRecord } from './rtdbRecords'
import { normalizeText } from '../utils/normalization'

const normalize = (value) => normalizeText(value)

export async function seedMasterOptions(uid) {
  const target = ref(rtdb, `users/${uid}/masterOptions`)
  const current = (await get(target)).val() || {}
  const seen = new Set(Object.values(current).map((item) => `${item.group}:${item.normalizedLabel}`))
  const changes = {}
  let count = 0
  Object.entries(MASTER_DEFAULTS).forEach(([group, labels]) => labels.forEach((label, sortOrder) => {
    const normalizedLabel = normalize(label)
    if (seen.has(`${group}:${normalizedLabel}`)) return
    const id = `${group}-${normalizedLabel}`.replace(/[^a-z0-9]+/gi, '-')
    changes[id] = { group, label, normalizedLabel, description: '', isActive: true, isSystem: true, sortOrder, ownerId: uid, ownerUid: uid, createdAt: rtdbNow(), updatedAt: rtdbNow(), createdBy: uid, updatedBy: uid }
    count += 1
  }))
  if (count) await update(target, changes)
  return count
}

export async function createMasterOption(uid, values) {
  const label = String(values.label || '').trim().replace(/\s+/g, ' ')
  const group = String(values.group || '').trim()
  const normalizedLabel = normalize(label)
  if (!label || !group) throw new Error('A group and option label are required.')
  const id = newRtdbId(uid, 'masterOptions')
  const now = rtdbNow()
  await transactUserRoot(uid, (state) => {
    const duplicate = Object.values(state.masterOptions || {}).some((item) => item?.group === group && item.normalizedLabel === normalizedLabel && item.isActive !== false)
    if (duplicate) throw new Error('An option with this label already exists in this group.')
    state.masterOptions ||= {}
    state.masterOptions[id] = { ...values, id, group, label, normalizedLabel, isActive: values.isActive !== false, ownerId: uid, ownerUid: uid, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid }
    return state
  })
  return { id }
}

export const updateMasterOption = (uid, id, values) => updateRtdbRecord(uid, 'masterOptions', 'Master Data', id, values)

