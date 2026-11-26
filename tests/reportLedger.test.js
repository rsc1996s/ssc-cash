import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFundDashboard } from "../src/lib/dashboardCash.js";
import { currentFundBalance, statementForRange } from "../src/lib/ledger.js";
import { buildBusinessDateLedger, localCalendarDate, reportTransactionDate } from "../src/lib/reportLedger.js";

const timestamp = (value) => ({ toDate: () => new Date(value) });

test("statement uses business dates and matches the dashboard for the selected month", () => {
  const fund = { id: "a", openingBalance: 20000 };
  const topups = [
    { fundId: "a", amount: 300, topupDate: timestamp("2026-08-03T17:00:00Z"), createdAt: timestamp("2026-11-25T07:00:00Z") },
    { fundId: "a", amount: 100, createdAt: timestamp("2026-07-31T17:00:00Z") },
    { fundId: "a", amount: 700, status: "voided", topupDate: timestamp("2026-08-03T17:00:00Z") },
    { fundId: "b", amount: 999, createdAt: timestamp("2026-08-01T00:00:00Z") },
  ];
  const transactions = [
    { fundId: "a", type: "income", status: "approved", amount: 3000, transactionDate: "2026-08-04", createdAt: timestamp("2026-11-25T07:24:00Z"), reviewedAt: timestamp("2026-11-25T07:25:00Z") },
    { fundId: "a", type: "expense", status: "approved", amount: 1100, transactionDate: "2026-08-31" },
    { fundId: "a", type: "expense", status: "pending", amount: 500, transactionDate: "2026-08-01" },
    { fundId: "a", type: "expense", status: "approved", amount: 50, transactionDate: "2026-07-31" },
    { fundId: "a", type: "income", status: "approved", amount: 20, transactionDate: "2026-09-01" },
    { fundId: "b", type: "income", status: "approved", amount: 999, transactionDate: "2026-08-01" },
  ];
  const { ledger, invalidCount } = buildBusinessDateLedger(fund, topups, transactions);
  const start = localCalendarDate("2026-08-01");
  const end = localCalendarDate("2026-08-31");
  end.setHours(23, 59, 59, 999);
  const statement = statementForRange(ledger, start, end, fund.openingBalance);
  const dashboard = calculateFundDashboard(fund, topups, transactions, "2026-08");

  assert.equal(invalidCount, 0);
  assert.equal(statement.openingBalance, 19950);
  assert.equal(statement.totalIn, 3400);
  assert.equal(statement.totalOut, 1100);
  assert.equal(statement.closingBalance, 22250);
  assert.equal(statement.entries.length, 4);
  assert.deepEqual(
    [statement.openingBalance, statement.totalIn, statement.totalOut, statement.closingBalance],
    [dashboard.opening, dashboard.received, dashboard.expense, dashboard.balance],
  );
  assert.equal(ledger.at(-1).balance, currentFundBalance(fund, topups, transactions));
  assert.equal(reportTransactionDate(transactions[0]).getDate(), 4);
});

test("invalid dates are surfaced and legacy timestamps use Bangkok calendar dates", () => {
  const transactions = [
    { fundId: "a", status: "approved", type: "income", amount: 10, transactionDate: "2026-02-30", createdAt: timestamp("2026-02-01T00:00:00Z") },
    { fundId: "a", status: "approved", type: "income", amount: 20, createdAt: timestamp("2026-08-04T17:00:00Z") },
  ];
  const result = buildBusinessDateLedger({ id: "a", openingBalance: 0 }, [], transactions);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.ledger.length, 1);
  assert.equal(result.ledger[0].date.getDate(), 5);
  assert.equal(result.ledger[0].date.getMonth(), 7);
});
