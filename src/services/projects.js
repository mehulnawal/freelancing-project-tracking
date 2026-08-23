import { getRtdbRecord, subscribeRtdbCollection, createRtdbRecord, updateRtdbRecord } from './rtdbRecords'
export const subscribeProjects=(uid,cb,error)=>subscribeRtdbCollection(uid,'projects',cb,error)
export const getProject=(uid,id)=>getRtdbRecord(uid,'projects',id)
export const createProject=(uid,v)=>createRtdbRecord(uid,'projects','Project',{...v,isDeleted:false,deletedAt:null,deletedBy:null},{clientId:v.clientId})
export const updateProject=(uid,id,v)=>updateRtdbRecord(uid,'projects','Project',id,v,{clientId:v.clientId})
export const archiveProject=(uid,id)=>updateProject(uid,id,{status:'Archived'})
