import { safeSubtractMinorUnits } from "./money";

export const EXPENSE_TYPES = [
  "Business",
  "Project-related",
  "Personal",
  "Household",
];
export const EXPENSE_PAYMENT_STATUSES = ["Pending", "Paid", "Cancelled"];
export const isActiveExpense = (expense) =>
  expense &&
  expense.paymentStatus !== "Cancelled" &&
  expense.isArchived !== true;
export const isPaidExpense = (expense) =>
  isActiveExpense(expense) && expense.paymentStatus === "Paid";
export const expenseAccountDeltas = (oldExpense, nextExpense) => {
  const deltas = {};
  const add = (accountId, amount) => {
    if (accountId) deltas[accountId] = (deltas[accountId] || 0) + amount;
  };
  if (isPaidExpense(oldExpense))
    add(oldExpense.accountId, oldExpense.amountMinor);
  if (isPaidExpense(nextExpense))
    add(nextExpense.accountId, -nextExpense.amountMinor);
  return deltas;
};
export const expenseDisplayStatus = (expense, today = new Date()) => {
  if (expense?.paymentStatus !== "Pending" || !expense?.dueDate)
    return expense?.paymentStatus || "Pending";
  const due = expense.dueDate?.toDate?.() || new Date(expense.dueDate);
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return due < start ? "Overdue" : "Pending";
};
export const reimbursementSummary = (expense, reimbursements = []) => {
  if (!expense?.isClientReimbursable)
    return {
      status: "Not Reimbursable",
      receivedAmountMinor: 0,
      pendingAmountMinor: 0,
    };
  if (expense.reimbursementWaived)
    return { status: "Waived", receivedAmountMinor: 0, pendingAmountMinor: 0 };
  const receivedAmountMinor = reimbursements
    .filter(
      (income) =>
        income.status === "Active" && income.linkedExpenseId === expense.id,
    )
    .reduce((sum, income) => sum + income.amountMinor, 0);
  const pendingAmountMinor = safeSubtractMinorUnits(
    expense.amountMinor,
    receivedAmountMinor,
  );
  return {
    status:
      receivedAmountMinor >= expense.amountMinor
        ? "Fully Reimbursed"
        : receivedAmountMinor > 0
          ? "Partially Reimbursed"
          : expense.reimbursementRequested
            ? "Pending"
            : "Not Requested",
    receivedAmountMinor,
    pendingAmountMinor,
    overReimbursedAmountMinor: Math.max(
      0,
      receivedAmountMinor - expense.amountMinor,
    ),
  };
};
export const projectExpenseSummary = (project, expenses = []) => {
  const linked = expenses.filter(
    (expense) => expense.projectId === project?.id && isActiveExpense(expense),
  );
  const paid = linked
    .filter(isPaidExpense)
    .reduce((sum, expense) => sum + expense.amountMinor, 0);
  const pending = linked
    .filter((expense) => expense.paymentStatus === "Pending")
    .reduce((sum, expense) => sum + expense.amountMinor, 0);
  const total = linked.reduce((sum, expense) => sum + expense.amountMinor, 0);
  const reimbursable = linked
    .filter((expense) => expense.isClientReimbursable)
    .reduce((sum, expense) => sum + expense.amountMinor, 0);
  return {
    totalAmountMinor: total,
    paidAmountMinor: paid,
    pendingAmountMinor: pending,
    reimbursableAmountMinor: reimbursable,
    netReceivedMarginMinor: (project?.receivedAmountMinor || 0) - paid,
    contractMarginMinor: (project?.totalAmountMinor || 0) - total,
  };
};
export const recurrenceKey = (templateId, occurrenceDate) =>
  `${templateId}_${String(occurrenceDate).slice(0, 10)}`;
export const nextRecurringDate = (date, frequency, customIntervalDays = 1) => {
  const next = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  if (frequency === "Monthly") next.setMonth(next.getMonth() + 1);
  else if (frequency === "Quarterly") next.setMonth(next.getMonth() + 3);
  else if (frequency === "Half-yearly") next.setMonth(next.getMonth() + 6);
  else if (frequency === "Yearly") next.setFullYear(next.getFullYear() + 1);
  else
    next.setDate(next.getDate() + Math.max(1, Number(customIntervalDays) || 1));
  return next.toISOString().slice(0, 10);
};
