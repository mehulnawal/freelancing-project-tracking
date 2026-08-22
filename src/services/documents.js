import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { auditCreate, auditUpdate } from "./firestore";
const ref = collection(db, "projectDocuments");
export const subscribeProjectDocuments = (uid, projectId, callback, error) => onSnapshot(query(ref, where("ownerId", "==", uid), where("projectId", "==", projectId), orderBy("updatedAt", "desc")), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), error);
export const createProjectDocument = (uid, values) => addDoc(ref, auditCreate(uid, { ...values, ownerUid: uid, status: values.status || "Active", isArchived: false }));
export const updateProjectDocument = (uid, id, values) => updateDoc(doc(db, "projectDocuments", id), auditUpdate(uid, values));
export const archiveProjectDocument = (uid, id, archiveReason = "") => updateProjectDocument(uid, id, { isArchived: true, status: "Archived", archivedAt: new Date(), archivedBy: uid, archiveReason });
export const restoreProjectDocument = (uid, id) => updateProjectDocument(uid, id, { isArchived: false, status: "Active", archivedAt: null, archivedBy: null, archiveReason: null });
