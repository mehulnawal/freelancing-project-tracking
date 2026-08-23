import { subscribeRtdbFiltered, createRtdbRecord, updateRtdbRecord } from './rtdbRecords'
export const subscribeProjectDocuments=(uid,projectId,cb,error)=>subscribeRtdbFiltered(uid,'projectDocuments',x=>x.projectId===projectId,cb,error)
export const createProjectDocument=(uid,v)=>createRtdbRecord(uid,'projectDocuments','Project document',{...v,status:v.status||'Active',isArchived:false})
export const updateProjectDocument=(uid,id,v)=>updateRtdbRecord(uid,'projectDocuments','Project document',id,v)
export const archiveProjectDocument=(uid,id,archiveReason='')=>updateProjectDocument(uid,id,{isArchived:true,status:'Archived',archivedAt:Date.now(),archivedBy:uid,archiveReason})
export const restoreProjectDocument=(uid,id)=>updateProjectDocument(uid,id,{isArchived:false,status:'Active',archivedAt:null,archivedBy:null,archiveReason:null})
