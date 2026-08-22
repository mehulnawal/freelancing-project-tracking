import { get, ref } from 'firebase/database'
import { rtdb } from '../config/firebase'
import { MASTER_DEFAULTS } from '../constants/masterOptions'
import { createRtdbRecord, updateRtdbRecord } from './rtdbRecords'

export const createMasterOption = (uid, values) => createRtdbRecord(uid, 'masterOptions', 'Master Data', values)
export const updateMasterOption = (id, uid, values) => updateRtdbRecord(uid, 'masterOptions', 'Master Data', id, values)
export async function seedMasterOptions(uid) {
  const snapshot = await get(ref(rtdb, `users/${uid}/masterOptions`))
  const seen = new Set(Object.values(snapshot.val() || {}).map((item) => `${item.group}:${item.normalizedLabel}`))
  let count = 0
  for (const [group, labels] of Object.entries(MASTER_DEFAULTS)) for (const [index, label] of labels.entries()) {
    const key = `${group}:${label.toLowerCase()}`
    if (!seen.has(key)) { await createMasterOption(uid, { group, label, normalizedLabel: label.toLowerCase(), description: '', isActive: true, isSystem: true, sortOrder: index }); count += 1 }
  }
  return count
}
