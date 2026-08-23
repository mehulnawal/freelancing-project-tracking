import { subscribeRtdbCollection } from './rtdbRecords'
const SENSITIVE=/password|passphrase|secret|token|api.?key|credentialfields|plaintext|decrypted|vaultkey|recovery|pin/i;const AUDIT=/createdAt|updatedAt|createdBy|updatedBy|ownerId|ownerUid/i
const plain=(value)=>Array.isArray(value)?value.map(plain):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,SENSITIVE.test(key)?'[redacted]':plain(item)])):value
export const safeSnapshot=(value)=>Object.fromEntries(Object.entries(plain(value||{})).filter(([key])=>!AUDIT.test(key)))
export const changedFields=(before={},after={})=>[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])&&!SENSITIVE.test(key))
export const subscribeVersions=(uid,callback,onError)=>subscribeRtdbCollection(uid,'recordVersions',callback,onError,'createdAt')
export const isFinancialEntity=(type)=>['Account','Transfer','Income','Project Payment','Expense'].includes(type)
