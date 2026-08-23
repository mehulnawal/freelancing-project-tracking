import { getRtdbRecord, subscribeRtdbCollection, subscribeRtdbFiltered, createRtdbRecord, updateRtdbRecord } from './rtdbRecords'
export const subscribeCredentials=(uid,cb,error)=>subscribeRtdbCollection(uid,'credentials',cb,error)
export const subscribeProjectCredentials=(uid,projectId,cb,error)=>subscribeRtdbFiltered(uid,'credentials',x=>x.projectId===projectId,cb,error)
export const getVaultConfig=(uid)=>getRtdbRecord(uid,'credentialVaultConfigs','global')
export async function saveVaultConfig(uid,config){const current=await getVaultConfig(uid);return current?updateRtdbRecord(uid,'credentialVaultConfigs','Credential vault','global',config):createRtdbRecord(uid,'credentialVaultConfigs','Credential vault',config,{},'global')}
export async function createCredential(uid,metadata,envelopeOrBuilder){const id=crypto.randomUUID();const envelope=typeof envelopeOrBuilder==='function'?await envelopeOrBuilder(id):envelopeOrBuilder;await createRtdbRecord(uid,'credentials','Credential',{...metadata,...envelope,status:'Active',isArchived:false},{},id);return{id}}
export const updateCredential=(uid,id,v)=>updateRtdbRecord(uid,'credentials','Credential',id,v)
export const archiveCredential=(uid,id)=>updateCredential(uid,id,{isArchived:true,status:'Archived',archivedAt:Date.now(),archivedBy:uid})
export const restoreCredential=(uid,id)=>updateCredential(uid,id,{isArchived:false,status:'Active',archivedAt:null,archivedBy:null})
export const resetVaultRecords=async()=>{throw new Error('Vault reset requires recent Firebase re-authentication and is intentionally unavailable in this frontend-only release.')}


