import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFundDashboard, dashboardMonths, dashboardTransactionDate } from "../src/lib/dashboardCash.js";

const timestamp = (value) => ({ toDate: () => new Date(value) });

test("dashboard uses transaction dates and Bangkok creation date for legacy records", () => {
  assert.equal(dashboardTransactionDate({
    transactionDate: "2026-08-04",
    createdAt: timestamp("2026-11-25T07:24:00Z"),
    reviewedAt: timestamp("2026-11-25T07:25:00Z"),
  }), "2026-08-04");
  assert.equal(dashboardTransactionDate({ createdAt: timestamp("2026-08-04T17:00:00Z") }), "2026-08-05");
  assert.equal(dashboardTransactionDate({ transactionDate: "2026-02-30", createdAt: timestamp("2026-02-01T00:00:00Z") }), null);
});

test("fund dashboard groups approved transactions and topups by business month", () => {
  const fund = { id: "a", openingBalance: 100 };
  const topups = [
    { fundId: "a", amount: 300, topupDate: timestamp("2026-08-03T17:00:00Z"), createdAt: timestamp("2026-11-25T07:00:00Z") },
    { fundId: "a", amount: 50, createdAt: timestamp("2026-07-01T00:00:00Z") },
    { fundId: "b", amount: 900, topupDate: timestamp("2026-08-04T00:00:00Z") },
  ];
  const transactions = [
    { fundId: "a", type: "income", status: "approved", amount: 200, transactionDate: "2026-08-04", reviewedAt: timestamp("2026-11-25T07:25:00Z") },
    { fundId: "a", type: "expense", status: "approved", amount: 120, transactionDate: "2026-08-20" },
    { fundId: "a", type: "expense", status: "pending", amount: 500, transactionDate: "2026-08-20" },
    { fundId: "a", type: "expense", status: "approved", amount: 10, transactionDate: "2026-07-01" },
    { fundId: "a", type: "income", status: "approved", amount: 1000, transactionDate: "2026-09-01" },
    { fundId: "b", type: "expense", status: "approved", amount: 900, transactionDate: "2026-08-01" },
    { fundId: "a", type: "expense", status: "approved", amount: 2, transactionDate: "bad-date" },
  ];
  const result = calculateFundDashboard(fund, topups, transactions, "2026-08");
  assert.equal(result.opening, 140);
  assert.equal(result.topup, 300);
  assert.equal(result.income, 200);
  assert.equal(result.received, 500);
  assert.equal(result.expense, 120);
  assert.equal(result.balance, 520);
  assert.equal(result.invalidCount, 1);
  assert.deepEqual(result.months.map(({ key, income, expense }) => ({ key, income, expense })), [
    { key: "2026-03", income: 0, expense: 0 },
    { key: "2026-04", income: 0, expense: 0 },
    { key: "2026-05", income: 0, expense: 0 },
    { key: "2026-06", income: 0, expense: 0 },
    { key: "2026-07", income: 50, expense: 10 },
    { key: "2026-08", income: 500, expense: 120 },
  ]);
});

test("dashboard month windows cross years and reject invalid months", () => {
  assert.deepEqual(dashboardMonths("2026-02", 3).map((month) => month.key), ["2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(dashboardMonths("2026-13"), []);
});
