import { describe, expect, it } from "vitest";
import {
  expenseAccountDeltas,
  expenseDisplayStatus,
  nextRecurringDate,
  projectExpenseSummary,
  recurrenceKey,
  reimbursementSummary,
} from "./expenseLogic";

const paid = {
  id: "e1",
  paymentStatus: "Paid",
  amountMinor: 12500,
  accountId: "a1",
  isArchived: false,
};

describe("expense accounting logic", () => {
  it("does not affect an account while pending and deducts paid once", () => {
    expect(
      expenseAccountDeltas(null, { ...paid, paymentStatus: "Pending" }),
    ).toEqual({});
    expect(expenseAccountDeltas(null, paid)).toEqual({ a1: -12500 });
  });
  it("reverses an old paid expense and applies an edited account/amount", () => {
    expect(
      expenseAccountDeltas(paid, {
        ...paid,
        amountMinor: 20000,
        accountId: "a2",
      }),
    ).toEqual({ a1: 12500, a2: -20000 });
  });
  it("marks overdue only for a pending expense whose due date passed", () => {
    expect(
      expenseDisplayStatus(
        { paymentStatus: "Pending", dueDate: "2026-08-01" },
        new Date("2026-08-02T12:00:00"),
      ),
    ).toBe("Overdue");
    expect(
      expenseDisplayStatus(
        { paymentStatus: "Paid", dueDate: "2026-08-01" },
        new Date("2026-08-02T12:00:00"),
      ),
    ).toBe("Paid");
  });
  it("calculates project cash indicators without changing contract income", () => {
    const summary = projectExpenseSummary(
      { id: "p1", totalAmountMinor: 100000, receivedAmountMinor: 70000 },
      [
        paid,
        {
          id: "e2",
          projectId: "p1",
          paymentStatus: "Pending",
          amountMinor: 10000,
        },
        { ...paid, projectId: "p1" },
      ],
    );
    expect(summary.paidAmountMinor).toBe(12500);
    expect(summary.pendingAmountMinor).toBe(10000);
    expect(summary.netReceivedMarginMinor).toBe(57500);
  });
  it("derives reimbursement state only from active linked income", () => {
    expect(
      reimbursementSummary(
        { id: "e1", amountMinor: 1000, isClientReimbursable: true },
        [{ linkedExpenseId: "e1", status: "Active", amountMinor: 400 }],
      ),
    ).toMatchObject({
      status: "Partially Reimbursed",
      pendingAmountMinor: 600,
    });
  });
  it("uses deterministic recurrence keys and date progression", () => {
    expect(recurrenceKey("t1", "2026-08-01")).toBe("t1_2026-08-01");
    expect(nextRecurringDate("2026-01-31", "Monthly")).toBe("2026-03-03");
    expect(nextRecurringDate("2026-08-01", "Custom interval", 10)).toBe(
      "2026-08-11",
    );
  });
});
