import assert from "node:assert/strict";
import { test } from "node:test";
import { matchingRecentTopups } from "../src/lib/topupData.js";

test("recent topups match the same fund and satang amount within ten minutes", () => {
  const now = new Date("2026-01-02T10:00:00Z").getTime();
  const rows = [
    { id: "boundary", fundId: "a", amount: 10.1, createdAt: new Date(now - 600000) },
    { id: "timestamp", fundId: "a", amount: 10.1, createdAt: { toDate: () => new Date(now - 1) } },
    { id: "old", fundId: "a", amount: 10.1, createdAt: new Date(now - 600001) },
    { id: "other", fundId: "b", amount: 10.1, createdAt: new Date(now) },
    { id: "void", fundId: "a", amount: 10.1, status: "voided", createdAt: new Date(now) },
    { id: "invalid", fundId: "a", amount: 10.1, createdAt: null },
    { id: "bad-amount", fundId: "a", amount: "invalid", createdAt: new Date(now) },
  ];
  assert.deepEqual(matchingRecentTopups({ fundId: "a", amount: "10.10" }, rows, now).map((row) => row.id), ["boundary", "timestamp"]);
  assert.deepEqual(matchingRecentTopups({ fundId: "a", amount: "0" }, rows, now), []);
  assert.deepEqual(matchingRecentTopups({ fundId: "a", amount: "10.101" }, rows, now), []);
});
