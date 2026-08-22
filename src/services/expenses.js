import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { auditCreate, auditUpdate, withoutUndefined } from "./firestore";
import {
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_TYPES,
  expenseAccountDeltas,
  nextRecurringDate,
  recurrenceKey,
} from "../utils/expenseLogic";

const ACTIVE = "Active";
const EXPENSES = "expenses";
const TEMPLATES = "recurringExpenseTemplates";
const normalize = (value) => String(value || "").trim();
const toTimestamp = (value) => {
  if (value?.toDate) return value;
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
};
const assertAmount = (value) => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("Enter an expense amount greater than zero.");
};
const account = (id) => doc(db, "accounts", id);
const expense = (id) => doc(db, EXPENSES, id);
const template = (id) => doc(db, TEMPLATES, id);

export const subscribeExpenses = (uid, callback, onError) =>
  onSnapshot(
    query(
      collection(db, EXPENSES),
      where("ownerId", "==", uid),
      orderBy("expenseDate", "desc"),
    ),
    (snapshot) =>
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
export const subscribeProjectExpenses = (uid, projectId, callback, onError) =>
  onSnapshot(
    query(
      collection(db, EXPENSES),
      where("ownerId", "==", uid),
      where("projectId", "==", projectId),
      orderBy("expenseDate", "desc"),
    ),
    (snapshot) =>
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
export const subscribeClientExpenses = (uid, clientId, callback, onError) =>
  onSnapshot(
    query(
      collection(db, EXPENSES),
      where("ownerId", "==", uid),
      where("clientId", "==", clientId),
      orderBy("expenseDate", "desc"),
    ),
    (snapshot) =>
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
export const subscribeMonthlyPaidExpenses = (
  uid,
  start,
  end,
  callback,
  onError,
) =>
  onSnapshot(
    query(
      collection(db, EXPENSES),
      where("ownerId", "==", uid),
      where("paidDate", ">=", toTimestamp(start)),
      where("paidDate", "<=", toTimestamp(end)),
      orderBy("paidDate", "asc"),
    ),
    (snapshot) =>
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
export const subscribeMonthlyPendingExpenses = (uid, end, callback, onError) =>
  onSnapshot(
    query(
      collection(db, EXPENSES),
      where("ownerId", "==", uid),
      where("paymentStatus", "==", "Pending"),
      where("dueDate", "<=", toTimestamp(end)),
      orderBy("dueDate", "asc"),
    ),
    (snapshot) =>
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
export const subscribeRecurringTemplates = (uid, callback, onError) =>
  onSnapshot(
    query(
      collection(db, TEMPLATES),
      where("ownerId", "==", uid),
      orderBy("nextOccurrenceDate", "asc"),
    ),
    (snapshot) =>
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );

const cleanExpense = (values) =>
  withoutUndefined({
    title: normalize(values.title),
    amountMinor: values.amountMinor,
    currency: values.currency,
    expenseType: values.expenseType,
    categoryId: values.categoryId,
    subcategoryId: values.subcategoryId || null,
    description: normalize(values.description) || null,
    expenseDate: toTimestamp(values.expenseDate),
    dueDate: toTimestamp(values.dueDate),
    paidDate:
      values.paymentStatus === "Paid" ? toTimestamp(values.paidDate) : null,
    accountId: values.paymentStatus === "Paid" ? values.accountId : null,
    paymentModeId:
      values.paymentStatus === "Paid" ? values.paymentModeId : null,
    paymentStatus: values.paymentStatus,
    clientId: values.clientId || null,
    projectId: values.projectId || null,
    vendorId: values.vendorId || null,
    transactionReference: normalize(values.transactionReference) || null,
    notes: normalize(values.notes) || null,
    isClientReimbursable: Boolean(values.isClientReimbursable),
    reimbursementNotes: normalize(values.reimbursementNotes) || null,
    reimbursementWaived: Boolean(values.reimbursementWaived),
    reimbursementWaivedReason: values.reimbursementWaived
      ? normalize(values.reimbursementWaivedReason) || null
      : null,
    documentIds: Array.isArray(values.documentIds) ? values.documentIds : [],
    recurringTemplateId: values.recurringTemplateId || null,
    recurrenceOccurrenceDate: toTimestamp(values.recurrenceOccurrenceDate),
    isArchived: Boolean(values.isArchived),
  });
const validateExpense = (values) => {
  assertAmount(values.amountMinor);
  if (
    !normalize(values.title) ||
    !normalize(values.currency) ||
    !normalize(values.expenseType) ||
    !normalize(values.categoryId) ||
    !normalize(values.expenseDate) ||
    !EXPENSE_TYPES.includes(values.expenseType) ||
    !EXPENSE_PAYMENT_STATUSES.includes(values.paymentStatus)
  )
    throw new Error("Complete the required expense fields.");
  if (
    values.paymentStatus === "Paid" &&
    (!normalize(values.accountId) ||
      !normalize(values.paymentModeId) ||
      !normalize(values.paidDate))
  )
    throw new Error(
      "Paid expenses require an account, payment mode and paid date.",
    );
};
async function readAccounts(tx, deltas, currency, requireActiveIds = []) {
  const data = {};
  for (const id of Object.keys(deltas)) {
    const snapshot = await tx.get(account(id));
    if (!snapshot.exists()) throw new Error("A linked account is unavailable.");
    const current = snapshot.data();
    if (currency && current.currency !== currency)
      throw new Error("Expense and account currencies must match.");
    if (requireActiveIds.includes(id) && current.status !== ACTIVE)
      throw new Error("Choose an active account for a paid expense.");
    data[id] = { ref: snapshot.ref, ...current };
  }
  return data;
}
export async function createExpense(uid, values, fixedId = null) {
  validateExpense(values);
  const next = cleanExpense(values);
  return runTransaction(db, async (tx) => {
    const reference = fixedId
      ? expense(fixedId)
      : doc(collection(db, EXPENSES));
    const existing = fixedId ? await tx.get(reference) : null;
    if (existing?.exists()) return false;
    const deltas = expenseAccountDeltas(null, next);
    const accounts = await readAccounts(
      tx,
      deltas,
      next.currency,
      next.paymentStatus === "Paid" ? [next.accountId] : [],
    );
    Object.entries(deltas).forEach(([id, delta]) =>
      tx.update(
        accounts[id].ref,
        auditUpdate(uid, {
          currentBalanceMinor: accounts[id].currentBalanceMinor + delta,
          lastTransactionDate: next.paidDate,
        }),
      ),
    );
    tx.set(
      reference,
      auditCreate(uid, {
        ...next,
        ledgerReference: `expense:${reference.id}`,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      }),
    );
    return true;
  });
}
export async function updateExpense(
  uid,
  id,
  values,
  { confirmBalanceChange = false } = {},
) {
  validateExpense(values);
  const next = cleanExpense(values);
  await runTransaction(db, async (tx) => {
    const reference = expense(id);
    const snapshot = await tx.get(reference);
    if (!snapshot.exists() || snapshot.data().paymentStatus === "Cancelled")
      throw new Error("This expense cannot be edited. Restore it first.");
    const old = { id, ...snapshot.data() };
    const deltas = expenseAccountDeltas(old, next);
    if (
      Object.keys(deltas).length &&
      !confirmBalanceChange &&
      (old.paymentStatus === "Paid" || next.paymentStatus === "Paid")
    )
      throw new Error("Confirm the account balance change before saving.");
    const accounts = await readAccounts(
      tx,
      deltas,
      next.currency,
      next.paymentStatus === "Paid" ? [next.accountId] : [],
    );
    Object.entries(deltas).forEach(([accountId, delta]) =>
      tx.update(
        accounts[accountId].ref,
        auditUpdate(uid, {
          currentBalanceMinor: accounts[accountId].currentBalanceMinor + delta,
          lastTransactionDate: next.paidDate || old.paidDate,
        }),
      ),
    );
    tx.update(
      reference,
      auditUpdate(uid, { ...next, ledgerReference: `expense:${id}` }),
    );
  });
}
export async function cancelExpense(uid, id, reason) {
  if (!normalize(reason)) throw new Error("A cancellation reason is required.");
  await runTransaction(db, async (tx) => {
    const reference = expense(id);
    const snapshot = await tx.get(reference);
    if (!snapshot.exists() || snapshot.data().paymentStatus === "Cancelled")
      throw new Error("Expense cannot be cancelled.");
    const old = { id, ...snapshot.data() };
    const next = { ...old, paymentStatus: "Cancelled" };
    const deltas = expenseAccountDeltas(old, next);
    const accounts = await readAccounts(tx, deltas, old.currency);
    Object.entries(deltas).forEach(([accountId, delta]) =>
      tx.update(
        accounts[accountId].ref,
        auditUpdate(uid, {
          currentBalanceMinor: accounts[accountId].currentBalanceMinor + delta,
        }),
      ),
    );
    tx.update(
      reference,
      auditUpdate(uid, {
        paymentStatus: "Cancelled",
        paymentStatusBeforeCancellation: old.paymentStatus,
        cancelledAt: serverTimestamp(),
        cancelledBy: uid,
        cancellationReason: normalize(reason),
      }),
    );
  });
}
export async function restoreExpense(uid, id) {
  await runTransaction(db, async (tx) => {
    const reference = expense(id);
    const snapshot = await tx.get(reference);
    if (!snapshot.exists() || snapshot.data().paymentStatus !== "Cancelled")
      throw new Error("Expense cannot be restored.");
    const old = { id, ...snapshot.data() };
    const restoredStatus = old.paymentStatusBeforeCancellation || "Pending";
    const next = { ...old, paymentStatus: restoredStatus };
    const deltas = expenseAccountDeltas(old, next);
    const accounts = await readAccounts(
      tx,
      deltas,
      old.currency,
      restoredStatus === "Paid" ? [old.accountId] : [],
    );
    Object.entries(deltas).forEach(([accountId, delta]) =>
      tx.update(
        accounts[accountId].ref,
        auditUpdate(uid, {
          currentBalanceMinor: accounts[accountId].currentBalanceMinor + delta,
          lastTransactionDate: old.paidDate,
        }),
      ),
    );
    tx.update(
      reference,
      auditUpdate(uid, {
        paymentStatus: restoredStatus,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
      }),
    );
  });
}
export const getExpense = async (id) => {
  const snapshot = await getDoc(expense(id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};
export const createRecurringTemplate = (uid, values) =>
  addDoc(
    collection(db, TEMPLATES),
    auditCreate(uid, {
      ...withoutUndefined({
        ...values,
        title: normalize(values.title),
        nextOccurrenceDate: toTimestamp(values.nextOccurrenceDate),
        startDate: toTimestamp(values.startDate),
        endDate: toTimestamp(values.endDate),
        isActive: values.isActive !== false,
        isDeleted: false,
      }),
      lastGeneratedAt: null,
    }),
  );
export const updateRecurringTemplate = (uid, id, values) =>
  updateDoc(
    template(id),
    auditUpdate(
      uid,
      withoutUndefined({
        ...values,
        nextOccurrenceDate:
          values.nextOccurrenceDate === undefined
            ? undefined
            : toTimestamp(values.nextOccurrenceDate),
        startDate:
          values.startDate === undefined
            ? undefined
            : toTimestamp(values.startDate),
        endDate:
          values.endDate === undefined
            ? undefined
            : toTimestamp(values.endDate),
      }),
    ),
  );
export async function generateDueExpenses(
  uid,
  templates,
  today = new Date().toISOString().slice(0, 10),
) {
  let generated = 0;
  for (const item of templates.filter(
    (entry) => entry.isActive && entry.nextOccurrenceDate,
  )) {
    let occurrence =
      item.nextOccurrenceDate?.toDate?.().toISOString().slice(0, 10) ||
      String(item.nextOccurrenceDate).slice(0, 10);
    const end = item.endDate?.toDate?.().toISOString().slice(0, 10) || null;
    while (occurrence <= today && (!end || occurrence <= end)) {
      const id = recurrenceKey(item.id, occurrence);
      const created = await createExpense(
        uid,
        {
          title: item.title,
          amountMinor: item.amountMinor,
          currency: item.currency,
          expenseType: item.expenseType,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          clientId: item.clientId,
          projectId: item.projectId,
          vendorId: item.vendorId,
          expenseDate: occurrence,
          dueDate: occurrence,
          paymentStatus: item.defaultPaymentStatus || "Pending",
          paidDate: item.defaultPaymentStatus === "Paid" ? occurrence : null,
          accountId: item.defaultAccountId || null,
          paymentModeId: item.defaultPaymentModeId || null,
          notes: item.notes,
          recurringTemplateId: item.id,
          recurrenceOccurrenceDate: occurrence,
          isClientReimbursable: false,
        },
        id,
      );
      if (created) generated += 1;
      occurrence = nextRecurringDate(
        occurrence,
        item.frequency,
        item.customIntervalDays,
      );
    }
    await updateRecurringTemplate(uid, item.id, {
      nextOccurrenceDate: occurrence,
      lastGeneratedAt: serverTimestamp(),
    });
  }
  return generated;
}
