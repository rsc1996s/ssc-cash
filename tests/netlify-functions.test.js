import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bangkokBusinessDate,
  calculateCashBalance,
  canCloseDailyFund,
  toCents,
  validateBusinessDate,
} from "../netlify/functions/domain.mjs";
import handler from "../netlify/functions/close-daily-fund.mjs";

test("cash balance includes opening balance, topups, and approved cash transactions only", () => {
  const asOf = new Date("2026-11-07T04:00:00.000Z");
  const fund = { id: "fund-a", openingBalance: 1000 };
  const topups = [
    { fundId: "fund-a", amount: 100, createdAt: new Date("2026-11-06T00:00:00.000Z") },
    { fundId: "fund-b", amount: 500, createdAt: new Date("2026-11-06T00:00:00.000Z") },
    { fundId: "fund-a", amount: 50, createdAt: new Date("2026-11-07T05:00:00.000Z") },
  ];
  const transactions = [
    { fundId: "fund-a", status: "approved", type: "income", paymentMethod: "cash", amount: 200, createdAt: new Date("2026-11-06T00:00:00.000Z") },
    { fundId: "fund-a", status: "approved", type: "expense", paymentMethod: "cash", amount: 30, createdAt: new Date("2026-11-06T01:00:00.000Z") },
    { fundId: "fund-a", status: "approved", type: "income", paymentMethod: "transfer", amount: 500, createdAt: new Date("2026-11-06T01:00:00.000Z") },
    { fundId: "fund-a", status: "pending", type: "income", paymentMethod: "cash", amount: 900, createdAt: new Date("2026-11-06T01:00:00.000Z") },
  ];

  assert.equal(calculateCashBalance(fund, topups, transactions, asOf), 1270);
});

test("money conversion rejects invalid precision and unsafe values", () => {
  assert.equal(toCents(12.34, "amount"), 1234);
  assert.throws(() => toCents(1.001, "amount"), /two decimal places/);
  assert.throws(() => toCents(Number.MAX_VALUE, "amount"), /two decimal places/);
});

test("business dates must be valid ISO dates and use Bangkok calendar days", () => {
  assert.equal(validateBusinessDate("2026-11-07"), "2026-11-07");
  assert.throws(() => validateBusinessDate("2026-02-30"), /valid date/);
  assert.equal(bangkokBusinessDate(new Date("2026-11-06T18:00:00.000Z")), "2026-11-07");
});

test("only active owners and staff may close funds", () => {
  assert.equal(canCloseDailyFund({ role: "owner" }), true);
  assert.equal(canCloseDailyFund({ role: "staff" }), true);
  assert.equal(canCloseDailyFund({ role: "guest" }), false);
  assert.equal(canCloseDailyFund({ role: "owner", disabled: true }), false);
});

test("Netlify endpoint rejects other methods and requests without a Firebase token", async () => {
  const getResponse = await handler(new Request("https://example.test", { method: "GET" }));
  const unauthenticatedResponse = await handler(new Request("https://example.test", { method: "POST" }));

  assert.equal(getResponse.status, 405);
  assert.equal(unauthenticatedResponse.status, 401);
});
