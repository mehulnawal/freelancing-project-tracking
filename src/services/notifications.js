import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import { auditCreate, auditUpdate } from "./firestore";
export const DEFAULT_NOTIFICATION_PREFERENCES={projectReminderDays:7,paymentReminderDays:7,expenseReminderDays:7,projectEnabled:true,paymentEnabled:true,expenseEnabled:true,subtleAnimation:true,browserNotifications:false,quietHoursStart:"",quietHoursEnd:""};
const states=collection(db,"notificationStates");
export async function getNotificationPreferences(uid){const snap=await getDocs(query(collection(db,"notificationPreferences"),where("ownerUid","==",uid),limit(1)));return snap.docs[0]?{id:snap.docs[0].id,...DEFAULT_NOTIFICATION_PREFERENCES,...snap.docs[0].data()}:DEFAULT_NOTIFICATION_PREFERENCES;}
export const saveNotificationPreferences=(uid,values)=>setDoc(doc(db,"notificationPreferences",uid),auditCreate(uid,{ownerUid:uid,...DEFAULT_NOTIFICATION_PREFERENCES,...values}),{merge:true});
export async function loadNotificationStates(uid){const snap=await getDocs(query(states,where("ownerUid","==",uid),orderBy("updatedAt","desc"),limit(200)));return snap.docs.map(x=>({id:x.id,...x.data()}));}
export const updateNotificationState=(uid,id,fields)=>setDoc(doc(db,"notificationStates",id),auditCreate(uid,{ownerUid:uid,notificationId:id,fingerprint:id,...fields}),{merge:true});
export const markAllNotificationsRead=async(uid,ids)=>{const batch=writeBatch(db);ids.forEach(id=>batch.set(doc(db,"notificationStates",id),auditCreate(uid,{ownerUid:uid,notificationId:id,fingerprint:id,readAt:serverTimestamp()}),{merge:true}));return batch.commit();};
export const clearResolvedNotificationStates=async(uid,activeIds)=>{const current=await loadNotificationStates(uid);const batch=writeBatch(db);current.filter(x=>!activeIds.has(x.notificationId)&&!x.snoozedUntil&&!x.dismissedAt).slice(0,100).forEach(x=>batch.update(doc(db,"notificationStates",x.id),auditUpdate(uid,{resolvedAt:serverTimestamp()})));return batch.commit();};
