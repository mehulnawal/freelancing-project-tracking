import { describe, expect, it } from "vitest";
import {
  monthRange,
  monthlyCashSummary,
  percentageDifference,
  previousMonth,
} from "./monthlyLogic";

describe("monthly cash-basis logic", () => {
  it("uses the selected month boundaries", () => {
    expect(monthRange(2026, 7)).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
    });
    expect(previousMonth(2026, 0)).toEqual({ year: 2025, month: 11 });
  });
  it("counts only active received income and paid expenses by their payment dates", () => {
    const result = monthlyCashSummary({
      range: monthRange(2026, 7),
      income: [
        { status: "Active", receivedDate: "2026-08-01", amountMinor: 1000 },
        { status: "Voided", receivedDate: "2026-08-03", amountMinor: 999 },
      ],
      expenses: [
        {
          paymentStatus: "Paid",
          paidDate: "2026-08-02",
          amountMinor: 400,
          expenseType: "Business",
        },
        { paymentStatus: "Pending", dueDate: "2026-08-03", amountMinor: 200 },
      ],
    });
    expect(result.totalIncomeMinor).toBe(1000);
    expect(result.totalExpensesMinor).toBe(400);
    expect(result.pendingPayableMinor).toBe(200);
    expect(result.netCashFlowMinor).toBe(600);
  });
  it("does not create an infinite percentage when previous is zero", () => {
    expect(percentageDifference(100, 0)).toBeNull();
    expect(percentageDifference(150, 100)).toBe(50);
  });
});
