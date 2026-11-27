import assert from "node:assert/strict";
import { test } from "node:test";
import { bangkokDate, formatBangkokDate, formatBusinessDate, parseBangkokDate } from "../src/lib/businessDate.js";
import { formatDate, formatDateTime } from "../src/lib/format.js";
import { buildFundLedger, currentFundBalance } from "../src/lib/ledger.js";

test("top-up dates use the Bangkok calendar and reject invalid dates", () => {
  assert.equal(bangkokDate(new Date("2026-01-01T16:59:59Z")), "2026-01-01");
  assert.equal(bangkokDate(new Date("2026-01-01T17:00:00Z")), "2026-01-02");
  assert.equal(parseBangkokDate("2024-02-29").toISOString(), "2024-02-28T17:00:00.000Z");
  assert.equal(parseBangkokDate("2025-02-29"), null);
  assert.equal(parseBangkokDate("2026-2-01"), null);
  assert.equal(formatBangkokDate(parseBangkokDate("2026-01-02")), "02/01/2569");
  assert.equal(formatBusinessDate("2026-01-02"), "02/01/2569");
  assert.equal(formatBusinessDate("invalid"), "-");
  assert.equal(formatBangkokDate(null), "-");
  assert.equal(formatDate(new Date(2026, 0, 2, 14, 5)), "02/01/2569");
  assert.equal(formatDate("2026-01-02"), "02/01/2569");
  assert.equal(formatDateTime(new Date(2026, 0, 2, 14, 5)), "02/01/2569 14:05");
});

test("a descriptive top-up date does not change the ledger or balance", () => {
  const fund = { id: "fund-a", openingBalance: 100 };
  const createdAt = new Date("2026-02-01T04:00:00Z");
  const topups = [{ fundId: fund.id, amount: 25, createdAt, topupDate: parseBangkokDate("2026-01-01") }];
  const ledger = buildFundLedger(fund, topups, []);
  assert.equal(ledger[0].date.getTime(), createdAt.getTime());
  assert.equal(currentFundBalance(fund, topups, []), 125);
});

test("voided topups and transactions are excluded from the fund balance", () => {
  const fund = { id: "fund-a", openingBalance: 100 };
  const topups = [
    { fundId: fund.id, amount: 25, createdAt: new Date() },
    { fundId: fund.id, amount: 500, status: "voided", createdAt: new Date() },
  ];
  const transactions = [
    { fundId: fund.id, amount: 10, type: "expense", status: "approved", createdAt: new Date() },
    { fundId: fund.id, amount: 400, type: "expense", status: "voided", createdAt: new Date() },
  ];
  assert.equal(buildFundLedger(fund, topups, transactions).length, 2);
  assert.equal(currentFundBalance(fund, topups, transactions), 115);
});
