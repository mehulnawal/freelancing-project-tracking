import { isActiveExpense, isPaidExpense } from "./expenseLogic";

const datePart = (value) =>
  value?.toDate?.().toISOString().slice(0, 10) ||
  String(value || "").slice(0, 10);
export const monthRange = (year, month) => ({
  start: `${year}-${String(month + 1).padStart(2, "0")}-01`,
  end: `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`,
});
export const previousMonth = (year, month) =>
  month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
export const monthLabel = (year, month, locale = "en-IN") =>
  new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month, 1)),
  );
export const inMonth = (value, range) => {
  const date = datePart(value);
  return Boolean(date && date >= range.start && date <= range.end);
};
export const percentageDifference = (current, previous) =>
  previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
export const monthlyCashSummary = ({ income = [], expenses = [], range }) => {
  const receivedIncome = income.filter(
    (item) => item.status === "Active" && inMonth(item.receivedDate, range),
  );
  const paidExpenses = expenses.filter(
    (item) => isPaidExpense(item) && inMonth(item.paidDate, range),
  );
  const sum = (items) =>
    items.reduce((total, item) => total + item.amountMinor, 0);
  const byType = (type) =>
    sum(paidExpenses.filter((item) => item.expenseType === type));
  return {
    receivedIncome,
    paidExpenses,
    totalIncomeMinor: sum(receivedIncome),
    totalExpensesMinor: sum(paidExpenses),
    netCashFlowMinor: sum(receivedIncome) - sum(paidExpenses),
    projectIncomeMinor: sum(
      receivedIncome.filter((item) => item.sourceType === "Project Payment"),
    ),
    otherIncomeMinor: sum(
      receivedIncome.filter((item) => item.sourceType !== "Project Payment"),
    ),
    reimbursementIncomeMinor: sum(
      receivedIncome.filter((item) => item.linkedExpenseId),
    ),
    businessExpensesMinor: byType("Business"),
    projectExpensesMinor: byType("Project-related"),
    personalExpensesMinor: byType("Personal"),
    householdExpensesMinor: byType("Household"),
    pendingPayableMinor: sum(
      expenses.filter(
        (item) => isActiveExpense(item) && item.paymentStatus === "Pending",
      ),
    ),
    pendingReceivableMinor: 0,
  };
};
export const groupBy = (items, key) =>
  Object.entries(
    items.reduce((result, item) => {
      const name = item[key] || "Uncategorized";
      result[name] = (result[name] || 0) + item.amountMinor;
      return result;
    }, {}),
  ).map(([name, amountMinor]) => ({ name, amountMinor }));
export const dailySeries = (income, expenses, range) => {
  const rows = {};
  const ensure = (date) => {
    if (!rows[date]) rows[date] = { date, income: 0, expenses: 0 };
    return rows[date];
  };
  income
    .filter((item) => inMonth(item.receivedDate, range))
    .forEach((item) => {
      ensure(datePart(item.receivedDate)).income += item.amountMinor;
    });
  expenses
    .filter((item) => inMonth(item.paidDate, range))
    .forEach((item) => {
      ensure(datePart(item.paidDate)).expenses += item.amountMinor;
    });
  return Object.values(rows).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
};
