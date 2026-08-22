import { safeSubtractMinorUnits } from "./money";

export const transferDeltas = (oldTransfer, nextTransfer) => {
  const deltas = {};
  const add = (id, amount) => {
    deltas[id] = (deltas[id] || 0) + amount;
  };
  if (oldTransfer) {
    add(oldTransfer.fromAccountId, oldTransfer.amountMinor);
    add(oldTransfer.toAccountId, -oldTransfer.amountMinor);
  }
  if (nextTransfer) {
    add(nextTransfer.fromAccountId, -nextTransfer.amountMinor);
    add(nextTransfer.toAccountId, nextTransfer.amountMinor);
  }
  return deltas;
};
export const incomeAccountDeltas = (oldIncome, nextIncome) => {
  const deltas = {};
  const add = (id, amount) => {
    if (id) deltas[id] = (deltas[id] || 0) + amount;
  };
  if (oldIncome?.status === "Active")
    add(oldIncome.accountId, -oldIncome.amountMinor);
  if (nextIncome?.status === "Active")
    add(nextIncome.accountId, nextIncome.amountMinor);
  return deltas;
};
export const latestPayment = (payments) =>
  payments
    .filter(
      (item) =>
        item.status === "Active" && item.sourceType === "Project Payment",
    )
    .slice()
    .sort((left, right) => {
      const date = (item) =>
        item.receivedDate?.toMillis?.() ||
        item.receivedDate?.seconds * 1000 ||
        new Date(item.receivedDate || 0).getTime() ||
        0;
      return (
        date(right) - date(left) ||
        String(right.id || "").localeCompare(String(left.id || ""))
      );
    })[0] || null;
export const sortLedgerEntries = (entries) =>
  entries.slice().sort((left, right) => {
    const date = (item) =>
      item.date?.toMillis?.() ||
      item.date?.seconds * 1000 ||
      new Date(item.date || 0).getTime() ||
      0;
    return (
      date(left) - date(right) ||
      String(left.id).localeCompare(String(right.id))
    );
  });
export const projectPaymentSummary = (totalAmountMinor, payments) => {
  const receivedAmountMinor = payments
    .filter(
      (item) =>
        item.status === "Active" && item.sourceType === "Project Payment",
    )
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const remainingAmountMinor = safeSubtractMinorUnits(
    totalAmountMinor,
    receivedAmountMinor,
  );
  const overpaidAmountMinor = Math.max(
    0,
    receivedAmountMinor - (totalAmountMinor || 0),
  );
  return {
    receivedAmountMinor,
    remainingAmountMinor,
    overpaidAmountMinor,
    paymentStatus: overpaidAmountMinor
      ? "Overpaid"
      : totalAmountMinor > 0 && receivedAmountMinor >= totalAmountMinor
        ? "Fully Paid"
        : receivedAmountMinor
          ? "Partially Paid"
          : "Not Started",
  };
};
export const clientFinancialSummary = (projects) =>
  projects.reduce(
    (summary, project) => {
      const total = project.totalAmountMinor || 0;
      const received = project.receivedAmountMinor || 0;
      const remaining = project.remainingAmountMinor || 0;
      const overpaid =
        project.overpaidAmountMinor || Math.max(0, received - total);
      summary.totalProjectValueMinor += total;
      summary.receivedAmountMinor += received;
      summary.remainingAmountMinor += remaining;
      summary.overpaidAmountMinor += overpaid;
      if (project.paymentStatus === "Fully Paid")
        summary.fullyPaidProjects += 1;
      else if (received > 0) summary.partiallyPaidProjects += 1;
      else summary.unpaidProjects += 1;
      return summary;
    },
    {
      totalProjectValueMinor: 0,
      receivedAmountMinor: 0,
      remainingAmountMinor: 0,
      overpaidAmountMinor: 0,
      fullyPaidProjects: 0,
      partiallyPaidProjects: 0,
      unpaidProjects: 0,
    },
  );
