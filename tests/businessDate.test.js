import assert from "node:assert/strict";
import { test } from "node:test";
import { bangkokDate, formatBangkokDate, parseBangkokDate } from "../src/lib/businessDate.js";
import { buildFundLedger, currentFundBalance } from "../src/lib/ledger.js";

test("top-up dates use the Bangkok calendar and reject invalid dates", () => {
  assert.equal(bangkokDate(new Date("2026-01-01T16:59:59Z")), "2026-01-01");
  assert.equal(bangkokDate(new Date("2026-01-01T17:00:00Z")), "2026-01-02");
  assert.equal(parseBangkokDate("2024-02-29").toISOString(), "2024-02-28T17:00:00.000Z");
  assert.equal(parseBangkokDate("2025-02-29"), null);
  assert.equal(parseBangkokDate("2026-2-01"), null);
  assert.equal(formatBangkokDate(parseBangkokDate("2026-01-02")), "2 ม.ค. 2569");
});

test("a descriptive top-up date does not change the ledger or balance", () => {
  const fund = { id: "fund-a", openingBalance: 100 };
  const createdAt = new Date("2026-02-01T04:00:00Z");
  const topups = [{ fundId: fund.id, amount: 25, createdAt, topupDate: parseBangkokDate("2026-01-01") }];
  const ledger = buildFundLedger(fund, topups, []);
  assert.equal(ledger[0].date.getTime(), createdAt.getTime());
  assert.equal(currentFundBalance(fund, topups, []), 125);
});
