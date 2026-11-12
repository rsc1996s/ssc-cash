import test from "node:test";
import assert from "node:assert/strict";
import { withdrawalReportRows } from "../src/components/withdrawalReportData.js";

test("keeps all ordinary withdrawal lines in their original order", () => {
  const lines = [
    { lineNo: 1, categoryLabel: "ทั่วไป", description: "รายการหนึ่ง", amount: 10 },
    { lineNo: 2, categoryLabel: "ทั่วไป", description: "รายการสอง", amount: 20 },
  ];
  assert.deepEqual(withdrawalReportRows(lines).map((row) => row.line), lines);
});

test("groups lines by category and calculates subtotals without changing line amounts", () => {
  const rows = withdrawalReportRows([
    { lineNo: 1, categoryLabel: "ขนส่ง", description: "รถ", amount: 12.5 },
    { lineNo: 2, categoryLabel: "ของใช้", description: "กล่อง", amount: 7 },
    { lineNo: 3, categoryLabel: "ขนส่ง", description: "ส่งของ", amount: 2.5 },
  ], true);
  assert.deepEqual(rows.filter((row) => row.type === "subtotal").map((row) => [row.category, row.amount]), [
    ["ขนส่ง", 15],
    ["ของใช้", 7],
  ]);
  assert.equal(rows.filter((row) => row.type === "line").reduce((sum, row) => sum + row.line.amount, 0), 22);
});
