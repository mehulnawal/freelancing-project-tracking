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
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { auditCreate, auditUpdate, withoutUndefined } from "./firestore";
import { projectPaymentSummary } from "../utils/financialConsistency";

const ACTIVE = "Active";
const VOIDED = "Voided";
const isMinor = (value) => Number.isSafeInteger(value) && value >= 0;
const assertMinor = (value, label = "Amount") => {
  if (!isMinor(value) || value <= 0)
    throw new Error(`${label} must be greater than zero.`);
};
const normal = (value) => String(value || "").trim();
const accountRef = (id) => doc(db, "accounts", id);
const projectRef = (id) => doc(db, "projects", id);
const incomeRef = (id) => doc(db, "income", id);
const transferRef = (id) => doc(db, "accountTransfers", id);
const incomeForProject = (uid, projectId) =>
  query(
    collection(db, "income"),
    where("ownerId", "==", uid),
    where("projectId", "==", projectId),
    where("status", "==", ACTIVE),
  );
const dateValue = (value) =>
  value?.toMillis?.() ||
  value?.seconds * 1000 ||
  new Date(value || 0).getTime() ||
  0;

export const subscribeAccounts = (uid, cb, error) =>
  onSnapshot(
    query(
      collection(db, "accounts"),
      where("ownerId", "==", uid),
      orderBy("updatedAt", "desc"),
    ),
    (snapshot) =>
      cb(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    error,
  );
export const subscribeIncome = (uid, cb, error) =>
  onSnapshot(
    query(
      collection(db, "income"),
      where("ownerId", "==", uid),
      orderBy("receivedDate", "desc"),
    ),
    (snapshot) =>
      cb(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    error,
  );
export const subscribeMonthlyIncome = (uid, start, end, cb, error) =>
  onSnapshot(
    query(
      collection(db, "income"),
      where("ownerId", "==", uid),
      where("receivedDate", ">=", dateToTimestamp(start)),
      where("receivedDate", "<=", dateToTimestamp(end)),
      orderBy("receivedDate", "asc"),
    ),
    (snapshot) => cb(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    error,
  );
export const subscribeProjectIncome = (uid, projectId, cb, error) =>
  onSnapshot(
    query(
      collection(db, "income"),
      where("ownerId", "==", uid),
      where("projectId", "==", projectId),
      orderBy("receivedDate", "desc"),
    ),
    (snapshot) =>
      cb(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    error,
  );
export const subscribeTransfers = (uid, cb, error) =>
  onSnapshot(
    query(
      collection(db, "accountTransfers"),
      where("ownerId", "==", uid),
      orderBy("transferDate", "desc"),
    ),
    (snapshot) =>
      cb(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    error,
  );

export const dateToTimestamp = (value) => {
  if (value?.toDate) return value;
  const text = normal(value);
  if (!text) return null;
  const date = new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
};

async function ensureAccount(tx, id, currency, { activeOnly = false } = {}) {
  const snapshot = await tx.get(accountRef(id));
  if (!snapshot.exists())
    throw new Error("The selected account is unavailable.");
  const data = snapshot.data();
  if (activeOnly && data.status !== ACTIVE)
    throw new Error("Choose an active account for a new transaction.");
  if (currency && data.currency !== currency)
    throw new Error(
      "Account currency does not match the transaction currency.",
    );
  return { ref: snapshot.ref, ...data };
}

async function recomputeProjectInTransaction(tx, uid, projectId, changed = {}) {
  if (!projectId) return;
  const [projectSnap, incomeSnap] = await Promise.all([
    tx.get(projectRef(projectId)),
    tx.get(incomeForProject(uid, projectId)),
  ]);
  if (!projectSnap.exists())
    throw new Error("The linked project is unavailable.");
  const initial = incomeSnap.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
  const patched = initial.map((item) =>
    changed[item.id] ? { ...item, ...changed[item.id] } : item,
  );
  Object.entries(changed).forEach(([id, item]) => {
    if (!initial.some((current) => current.id === id))
      patched.push({ id, ...item });
  });
  const payments = patched.filter(
    (item) =>
      item.status === ACTIVE &&
      item.sourceType === "Project Payment" &&
      item.projectId === projectId,
  );
  const summary = projectPaymentSummary(
    projectSnap.data().totalAmountMinor,
    payments,
  );
  const latest = payments
    .slice()
    .sort(
      (a, b) =>
        dateValue(b.receivedDate) - dateValue(a.receivedDate) ||
        String(b.id).localeCompare(String(a.id)),
    )[0];
  return {
    ref: projectSnap.ref,
    totalAmountMinor: projectSnap.data().totalAmountMinor || 0,
    ...projectPaymentSummary(projectSnap.data().totalAmountMinor, payments),
    patch: auditUpdate(uid, {
      receivedAmountMinor: summary.receivedAmountMinor,
      remainingAmountMinor: summary.remainingAmountMinor,
      overpaidAmountMinor: summary.overpaidAmountMinor,
      paymentStatus: summary.paymentStatus,
      lastPaymentDate: latest?.receivedDate || null,
    }),
  };
}

function validateIncome(values) {
  assertMinor(values.amountMinor);
  if (
    !normal(values.accountId) ||
    !normal(values.currency) ||
    !normal(values.receivedDate)
  )
    throw new Error(
      "Amount, account, currency and received date are required.",
    );
  if (!["Project Payment", "Independent Income"].includes(values.sourceType))
    throw new Error("Choose a valid income type.");
  if (!normal(values.incomeCategoryId) || !normal(values.paymentModeId))
    throw new Error("Income category and payment mode are required.");
  if (
    values.sourceType === "Project Payment" &&
    (!normal(values.projectId) ||
      !normal(values.clientId) ||
      !normal(values.paymentTypeId))
  )
    throw new Error(
      "Project payments require a project, client and payment type.",
    );
}

function cleanIncome(values) {
  const projectPayment = values.sourceType === "Project Payment";
  return withoutUndefined({
    title: normal(values.title),
    amountMinor: values.amountMinor,
    accountId: values.accountId,
    currency: values.currency,
    receivedDate: dateToTimestamp(values.receivedDate),
    incomeCategoryId: values.incomeCategoryId,
    paymentModeId: values.paymentModeId,
    paymentTypeId: values.paymentTypeId || null,
    sourceType: values.sourceType,
    clientId: projectPayment ? values.clientId : values.clientId || null,
    projectId: projectPayment ? values.projectId : null,
    linkedExpenseId: values.linkedExpenseId || null,
    referenceId: normal(values.referenceId) || null,
    notes: normal(values.notes) || null,
    nextPaymentDateAfterTransaction: projectPayment
      ? dateToTimestamp(values.nextPaymentDateAfterTransaction)
      : null,
    nextExpectedAmountMinorAfterTransaction:
      projectPayment && isMinor(values.nextExpectedAmountMinorAfterTransaction)
        ? values.nextExpectedAmountMinorAfterTransaction
        : null,
  });
}

export async function createAccount(uid, values) {
  if (
    !normal(values.name) ||
    !normal(values.accountTypeId) ||
    !normal(values.currency) ||
    !Number.isSafeInteger(values.openingBalanceMinor)
  )
    throw new Error("Complete the required account fields.");
  return addDoc(
    collection(db, "accounts"),
    auditCreate(
      uid,
      withoutUndefined({
        ...values,
        name: normal(values.name),
        normalizedName: normal(values.name).toLowerCase(),
        currentBalanceMinor: values.openingBalanceMinor,
        status: values.status || ACTIVE,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        lastTransactionDate: null,
      }),
    ),
  );
}
export const getAccount = async (id) => {
  const snapshot = await getDoc(accountRef(id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};
export async function updateAccount(
  uid,
  id,
  values,
  { confirmOpeningAdjustment = false } = {},
) {
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(accountRef(id));
    if (!snapshot.exists()) throw new Error("Account not found.");
    const current = snapshot.data();
    const nextOpening = values.openingBalanceMinor;
    const changingOpening =
      Number.isSafeInteger(nextOpening) &&
      nextOpening !== current.openingBalanceMinor;
    if (changingOpening && !confirmOpeningAdjustment)
      throw new Error("Confirm the opening balance correction before saving.");
    const openingDelta = changingOpening
      ? nextOpening - current.openingBalanceMinor
      : 0;
    tx.update(
      snapshot.ref,
      auditUpdate(
        uid,
        withoutUndefined({
          ...values,
          name: values.name === undefined ? undefined : normal(values.name),
          normalizedName:
            values.name === undefined
              ? undefined
              : normal(values.name).toLowerCase(),
          currentBalanceMinor: current.currentBalanceMinor + openingDelta,
          openingBalanceAdjustedAt: changingOpening
            ? serverTimestamp()
            : undefined,
          openingBalanceAdjustedBy: changingOpening ? uid : undefined,
        }),
      ),
    );
  });
}
export const archiveAccount = (uid, id, reason = "") =>
  updateAccount(uid, id, {
    status: "Archived",
    archiveReason: normal(reason) || null,
    archivedAt: serverTimestamp(),
    archivedBy: uid,
  });
export const reactivateAccount = (uid, id) =>
  updateAccount(uid, id, {
    status: ACTIVE,
    archiveReason: null,
    archivedAt: null,
    archivedBy: null,
  });

export async function createTransfer(uid, values) {
  assertMinor(values.amountMinor);
  if (
    !values.fromAccountId ||
    !values.toAccountId ||
    values.fromAccountId === values.toAccountId
  )
    throw new Error("Choose two different accounts.");
  await runTransaction(db, async (tx) => {
    const [from, to] = await Promise.all([
      ensureAccount(tx, values.fromAccountId, values.currency, {
        activeOnly: true,
      }),
      ensureAccount(tx, values.toAccountId, values.currency, {
        activeOnly: true,
      }),
    ]);
    if (from.currency !== to.currency)
      throw new Error("Transfer accounts must use the same currency.");
    if (
      from.currentBalanceMinor < values.amountMinor &&
      values.allowNegative !== true
    )
      throw new Error("Insufficient account balance.");
    const ref = doc(collection(db, "accountTransfers"));
    tx.set(
      ref,
      auditCreate(
        uid,
        withoutUndefined({
          ...values,
          transferDate: dateToTimestamp(values.transferDate),
          status: ACTIVE,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          voidedAt: null,
          voidedBy: null,
          voidReason: null,
          ledgerReferences: {
            from: `transfer:${ref.id}:out`,
            to: `transfer:${ref.id}:in`,
          },
        }),
      ),
    );
    tx.update(
      from.ref,
      auditUpdate(uid, {
        currentBalanceMinor: from.currentBalanceMinor - values.amountMinor,
        lastTransactionDate: dateToTimestamp(values.transferDate),
      }),
    );
    tx.update(
      to.ref,
      auditUpdate(uid, {
        currentBalanceMinor: to.currentBalanceMinor + values.amountMinor,
        lastTransactionDate: dateToTimestamp(values.transferDate),
      }),
    );
  });
}
export async function updateTransfer(uid, id, values) {
  assertMinor(values.amountMinor);
  if (
    !values.fromAccountId ||
    !values.toAccountId ||
    values.fromAccountId === values.toAccountId
  )
    throw new Error("Choose two different accounts.");
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(transferRef(id));
    if (!snapshot.exists() || snapshot.data().status !== ACTIVE)
      throw new Error("Only active transfers can be edited.");
    const old = snapshot.data();
    const ids = [
      ...new Set([
        old.fromAccountId,
        old.toAccountId,
        values.fromAccountId,
        values.toAccountId,
      ]),
    ];
    const accounts = {};
    for (const accountId of ids)
      accounts[accountId] = await ensureAccount(tx, accountId, null, {
        activeOnly:
          accountId === values.fromAccountId ||
          accountId === values.toAccountId,
      });
    if (
      accounts[values.fromAccountId].currency !==
        accounts[values.toAccountId].currency ||
      accounts[values.fromAccountId].currency !== values.currency
    )
      throw new Error("Transfer accounts must use the same currency.");
    const deltas = {};
    const add = (key, amount) => {
      deltas[key] = (deltas[key] || 0) + amount;
    };
    add(old.fromAccountId, old.amountMinor);
    add(old.toAccountId, -old.amountMinor);
    add(values.fromAccountId, -values.amountMinor);
    add(values.toAccountId, values.amountMinor);
    if (
      accounts[values.fromAccountId].currentBalanceMinor +
        deltas[values.fromAccountId] <
        0 &&
      values.allowNegative !== true
    )
      throw new Error("Insufficient account balance.");
    Object.entries(deltas).forEach(([key, delta]) =>
      tx.update(
        accounts[key].ref,
        auditUpdate(uid, {
          currentBalanceMinor: accounts[key].currentBalanceMinor + delta,
          lastTransactionDate: dateToTimestamp(values.transferDate),
        }),
      ),
    );
    tx.update(
      snapshot.ref,
      auditUpdate(
        uid,
        withoutUndefined({
          ...values,
          transferDate: dateToTimestamp(values.transferDate),
        }),
      ),
    );
  });
}
export async function voidTransfer(uid, id, reason) {
  if (!normal(reason)) throw new Error("A void reason is required.");
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(transferRef(id));
    if (!snapshot.exists() || snapshot.data().status !== ACTIVE)
      throw new Error("Transfer cannot be voided.");
    const item = snapshot.data();
    const [from, to] = await Promise.all([
      ensureAccount(tx, item.fromAccountId),
      ensureAccount(tx, item.toAccountId),
    ]);
    tx.update(
      from.ref,
      auditUpdate(uid, {
        currentBalanceMinor: from.currentBalanceMinor + item.amountMinor,
      }),
    );
    tx.update(
      to.ref,
      auditUpdate(uid, {
        currentBalanceMinor: to.currentBalanceMinor - item.amountMinor,
      }),
    );
    tx.update(
      snapshot.ref,
      auditUpdate(uid, {
        status: VOIDED,
        voidReason: normal(reason),
        voidedAt: serverTimestamp(),
        voidedBy: uid,
      }),
    );
  });
}
export async function restoreTransfer(uid, id) {
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(transferRef(id));
    if (!snapshot.exists() || snapshot.data().status !== VOIDED)
      throw new Error("Transfer cannot be restored.");
    const item = snapshot.data();
    const [from, to] = await Promise.all([
      ensureAccount(tx, item.fromAccountId, item.currency),
      ensureAccount(tx, item.toAccountId, item.currency),
    ]);
    if (from.status === "Archived" || to.status === "Archived")
      throw new Error(
        "Reactivate both accounts before restoring this transfer.",
      );
    if (from.currentBalanceMinor < item.amountMinor)
      throw new Error(
        "Source account has insufficient balance to restore this transfer.",
      );
    tx.update(
      from.ref,
      auditUpdate(uid, {
        currentBalanceMinor: from.currentBalanceMinor - item.amountMinor,
      }),
    );
    tx.update(
      to.ref,
      auditUpdate(uid, {
        currentBalanceMinor: to.currentBalanceMinor + item.amountMinor,
      }),
    );
    tx.update(
      snapshot.ref,
      auditUpdate(uid, {
        status: ACTIVE,
        restoredAt: serverTimestamp(),
        restoredBy: uid,
        voidReason: null,
      }),
    );
  });
}

export async function createIncome(uid, values) {
  validateIncome(values);
  const data = cleanIncome(values);
  await runTransaction(db, async (tx) => {
    const account = await ensureAccount(tx, data.accountId, data.currency, {
      activeOnly: true,
    });
    const ref = doc(collection(db, "income"));
    const projectSummary = data.projectId
      ? await recomputeProjectInTransaction(tx, uid, data.projectId, {
          [ref.id]: { id: ref.id, ...data, status: ACTIVE },
        })
      : null;
    if (
      projectSummary &&
      projectSummary.totalAmountMinor > 0 &&
      projectSummary.overpaidAmountMinor > 0 &&
      values.confirmOverpayment !== true
    )
      throw new Error(
        "This payment exceeds the project contract amount. Confirm the overpayment to continue.",
      );
    if (projectSummary) {
      const project = await tx.get(projectRef(data.projectId));
      if (project.data().clientId !== data.clientId)
        throw new Error("The selected client does not match the project.");
    }
    tx.set(
      ref,
      auditCreate(uid, {
        ...data,
        status: ACTIVE,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      }),
    );
    tx.update(
      account.ref,
      auditUpdate(uid, {
        currentBalanceMinor: account.currentBalanceMinor + data.amountMinor,
        lastTransactionDate: data.receivedDate,
      }),
    );
    if (projectSummary) tx.update(projectSummary.ref, projectSummary.patch);
  });
}

export async function updateIncome(uid, id, values) {
  validateIncome(values);
  const data = cleanIncome(values);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(incomeRef(id));
    if (!snapshot.exists() || snapshot.data().status !== ACTIVE)
      throw new Error("Only active income can be edited.");
    const old = snapshot.data();
    const oldAccount = await ensureAccount(tx, old.accountId);
    const newAccount =
      old.accountId === data.accountId
        ? oldAccount
        : await ensureAccount(tx, data.accountId, data.currency, {
            activeOnly: true,
          });
    if (newAccount.currency !== data.currency)
      throw new Error(
        "Account currency does not match the transaction currency.",
      );
    const changed = { [id]: { id, ...old, ...data, status: ACTIVE } };
    const affected = [
      ...new Set([old.projectId, data.projectId].filter(Boolean)),
    ];
    const summaries = [];
    for (const projectId of affected)
      summaries.push(
        await recomputeProjectInTransaction(tx, uid, projectId, changed),
      );
    const targetSummary = summaries.find(
      (item) => item.ref.id === data.projectId,
    );
    if (
      targetSummary &&
      targetSummary.totalAmountMinor > 0 &&
      targetSummary.overpaidAmountMinor > 0 &&
      values.confirmOverpayment !== true
    )
      throw new Error(
        "This payment exceeds the project contract amount. Confirm the overpayment to continue.",
      );
    if (old.accountId === data.accountId)
      tx.update(
        oldAccount.ref,
        auditUpdate(uid, {
          currentBalanceMinor:
            oldAccount.currentBalanceMinor - old.amountMinor + data.amountMinor,
          lastTransactionDate: data.receivedDate,
        }),
      );
    else {
      tx.update(
        oldAccount.ref,
        auditUpdate(uid, {
          currentBalanceMinor: oldAccount.currentBalanceMinor - old.amountMinor,
        }),
      );
      tx.update(
        newAccount.ref,
        auditUpdate(uid, {
          currentBalanceMinor:
            newAccount.currentBalanceMinor + data.amountMinor,
          lastTransactionDate: data.receivedDate,
        }),
      );
    }
    tx.update(snapshot.ref, auditUpdate(uid, data));
    summaries.forEach((summary) => tx.update(summary.ref, summary.patch));
  });
}

export async function voidIncome(uid, id, reason) {
  if (!normal(reason)) throw new Error("A void reason is required.");
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(incomeRef(id));
    if (!snapshot.exists() || snapshot.data().status !== ACTIVE)
      throw new Error("Income cannot be voided.");
    const item = snapshot.data();
    const account = await ensureAccount(tx, item.accountId);
    const summary = item.projectId
      ? await recomputeProjectInTransaction(tx, uid, item.projectId, {
          [id]: { id, ...item, status: VOIDED },
        })
      : null;
    tx.update(
      account.ref,
      auditUpdate(uid, {
        currentBalanceMinor: account.currentBalanceMinor - item.amountMinor,
      }),
    );
    tx.update(
      snapshot.ref,
      auditUpdate(uid, {
        status: VOIDED,
        voidReason: normal(reason),
        voidedAt: serverTimestamp(),
        voidedBy: uid,
      }),
    );
    if (summary) tx.update(summary.ref, summary.patch);
  });
}
export async function restoreIncome(uid, id) {
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(incomeRef(id));
    if (!snapshot.exists() || snapshot.data().status !== VOIDED)
      throw new Error("Income cannot be restored.");
    const item = snapshot.data();
    const account = await ensureAccount(tx, item.accountId, item.currency);
    if (account.status === "Archived")
      throw new Error(
        "Reactivate the receiving account before restoring income.",
      );
    const summary = item.projectId
      ? await recomputeProjectInTransaction(tx, uid, item.projectId, {
          [id]: { id, ...item, status: ACTIVE },
        })
      : null;
    if (
      summary &&
      summary.totalAmountMinor > 0 &&
      summary.overpaidAmountMinor > 0
    )
      throw new Error("Restoring this payment would overpay the project.");
    tx.update(
      account.ref,
      auditUpdate(uid, {
        currentBalanceMinor: account.currentBalanceMinor + item.amountMinor,
        lastTransactionDate: item.receivedDate,
      }),
    );
    tx.update(
      snapshot.ref,
      auditUpdate(uid, {
        status: ACTIVE,
        restoredAt: serverTimestamp(),
        restoredBy: uid,
        voidReason: null,
      }),
    );
    if (summary) tx.update(summary.ref, summary.patch);
  });
}
export async function reconcileProjectPayments(uid, projectId) {
  await runTransaction(db, async (tx) => {
    const summary = await recomputeProjectInTransaction(tx, uid, projectId);
    tx.update(summary.ref, summary.patch);
  });
}
export async function updateProjectPaymentReminder(uid, projectId, values) {
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(projectRef(projectId));
    if (!snapshot.exists()) throw new Error("Project is unavailable.");
    tx.update(
      snapshot.ref,
      auditUpdate(
        uid,
        withoutUndefined({
          nextPaymentDate: dateToTimestamp(values.nextPaymentDate),
          nextExpectedAmountMinor: values.nextExpectedAmountMinor,
        }),
      ),
    );
  });
}
