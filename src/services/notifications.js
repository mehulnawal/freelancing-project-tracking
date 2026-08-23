import { get, ref, update } from 'firebase/database'
import { rtdb } from '../config/firebase'
import { getRtdbRecord } from './rtdbRecords'
export const DEFAULT_NOTIFICATION_PREFERENCES={projectReminderDays:7,paymentReminderDays:7,expenseReminderDays:7,projectEnabled:true,paymentEnabled:true,expenseEnabled:true,subtleAnimation:true,browserNotifications:false,quietHoursStart:'',quietHoursEnd:''}
export async function getNotificationPreferences(uid){const data=await getRtdbRecord(uid,'notificationPreferences','global');return{...DEFAULT_NOTIFICATION_PREFERENCES,...(data||{})}}
export const saveNotificationPreferences=(uid,values)=>update(ref(rtdb,`users/${uid}/notificationPreferences/global`),{...DEFAULT_NOTIFICATION_PREFERENCES,...values,ownerId:uid,ownerUid:uid,updatedAt:Date.now()})
export async function loadNotificationStates(uid){const snap=await get(ref(rtdb,`users/${uid}/notificationStates`));return Object.entries(snap.val()||{}).map(([id,x])=>({id,...x})).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,200)}
export const updateNotificationState=(uid,id,fields)=>update(ref(rtdb,`users/${uid}/notificationStates/${id}`),{ownerId:uid,ownerUid:uid,notificationId:id,fingerprint:id,...fields,updatedAt:Date.now()})
export const markAllNotificationsRead=(uid,ids)=>update(ref(rtdb,`users/${uid}/notificationStates`),Object.fromEntries(ids.map(id=>[`${id}/readAt`,Date.now()])))
export async function clearResolvedNotificationStates(uid,activeIds){const current=await loadNotificationStates(uid);const patch={};current.filter(x=>!activeIds.has(x.notificationId)&&!x.snoozedUntil&&!x.dismissedAt).slice(0,100).forEach(x=>{patch[`${x.id}/resolvedAt`]=Date.now()});if(Object.keys(patch).length)await update(ref(rtdb,`users/${uid}/notificationStates`),patch)}
