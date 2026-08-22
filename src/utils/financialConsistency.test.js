import { describe, expect, it } from "vitest";
import {
  clientFinancialSummary,
  incomeAccountDeltas,
  latestPayment,
  projectPaymentSummary,
  sortLedgerEntries,
  transferDeltas,
} from "./financialConsistency";
describe("financial consistency", () => {
  it("reverses and reapplies a changed transfer exactly once", () =>
    expect(
      transferDeltas(
        { fromAccountId: "a", toAccountId: "b", amountMinor: 100 },
        { fromAccountId: "a", toAccountId: "c", amountMinor: 250 },
      ),
    ).toEqual({ a: -150, b: -100, c: 250 }));
  it("derives project totals only from active project income", () =>
    expect(
      projectPaymentSummary(1000, [
        { amountMinor: 400, status: "Active", sourceType: "Project Payment" },
        { amountMinor: 700, status: "Voided", sourceType: "Project Payment" },
        {
          amountMinor: 200,
          status: "Active",
          sourceType: "Independent Income",
        },
      ]),
    ).toMatchObject({
      receivedAmountMinor: 400,
      remainingAmountMinor: 600,
      paymentStatus: "Partially Paid",
    }));
  it("marks overpayments separately", () =>
    expect(
      projectPaymentSummary(100, [
        { amountMinor: 120, status: "Active", sourceType: "Project Payment" },
      ]).overpaidAmountMinor,
    ).toBe(20));
});
describe("client financial summary", () => {
  it("does not count independent income and derives project totals", () =>
    expect(
      clientFinancialSummary([
        {
          totalAmountMinor: 1000,
          receivedAmountMinor: 1000,
          remainingAmountMinor: 0,
          paymentStatus: "Fully Paid",
        },
        {
          totalAmountMinor: 500,
          receivedAmountMinor: 100,
          remainingAmountMinor: 400,
          paymentStatus: "Partially Paid",
        },
      ]),
    ).toMatchObject({
      totalProjectValueMinor: 1500,
      receivedAmountMinor: 1100,
      remainingAmountMinor: 400,
      fullyPaidProjects: 1,
      partiallyPaidProjects: 1,
    }));
});
describe("income and ledger transitions", () => {
  it("reverses an old income account and credits the new account once", () =>
    expect(
      incomeAccountDeltas(
        { accountId: "old", amountMinor: 500, status: "Active" },
        { accountId: "new", amountMinor: 700, status: "Active" },
      ),
    ).toEqual({ old: -500, new: 700 }));
  it("uses date then document ID for the latest payment and deterministic ledger order", () => {
    expect(
      latestPayment([
        {
          id: "a",
          status: "Active",
          sourceType: "Project Payment",
          receivedDate: "2026-01-01",
        },
        {
          id: "b",
          status: "Active",
          sourceType: "Project Payment",
          receivedDate: "2026-01-01",
        },
      ]).id,
    ).toBe("b");
    expect(
      sortLedgerEntries([
        { id: "b", date: "2026-01-01" },
        { id: "a", date: "2026-01-01" },
      ]).map((item) => item.id),
    ).toEqual(["a", "b"]);
  });
});
