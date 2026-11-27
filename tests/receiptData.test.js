import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSatang, sumSatang } from "../src/lib/money.js";
import { receiptCustomer, receiptDescription, receiptRows, receiptTotals } from "../src/lib/receiptData.js";
import { drainReceiptQueue } from "../src/lib/receiptQueue.js";
import { bangkokDate } from "../src/lib/businessDate.js";

test("receipt customer descriptions trim input, preserve legacy descriptions and reject excessive length", () => {
  assert.equal(receiptDescription("  "), "รับโอนจากลูกค้า");
  assert.equal(receiptCustomer(receiptDescription("  ลูกค้า ก  ")), "ลูกค้า ก");
  assert.equal(receiptCustomer("รายรับเก่า"), "");
  const max = 1000 - "รับโอนจากลูกค้า: ".length;
  assert.equal(receiptDescription("ก".repeat(max)).length, 1000);
  assert.throws(() => receiptDescription("ก".repeat(max + 1)));
});

test("amounts are checked and added in satang without order-dependent floating point errors", () => {
  const amounts = ["0.10", "0.20", "12.34", "1000000.01"];
  assert.equal(sumSatang(amounts), 100001265);
  assert.equal(sumSatang([...amounts].reverse()), 100001265);
  let seed = 41;
  for (let round = 0; round < 50; round += 1) {
    const shuffled = [...amounts];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const position = seed % (index + 1);
      [shuffled[index], shuffled[position]] = [shuffled[position], shuffled[index]];
    }
    assert.equal(sumSatang(shuffled), 100001265);
  }
  for (const bad of ["0", "-1", "1.001", "1000000000.01", "abc"]) {
    assert.throws(() => parseSatang(bad));
  }
});

test("receipt date defaults to Bangkok calendar independently of machine time zone", () => {
  assert.equal(bangkokDate(new Date("2026-08-03T17:00:00Z")), "2026-08-04");
  assert.equal(bangkokDate(new Date("2026-08-03T16:59:59Z")), "2026-08-03");
});

test("receipt rows and totals honor fund, date and staff ownership", () => {
  const rows = [
    { id: "a", fundId: "a", type: "income", paymentMethod: "transfer", transactionDate: "2026-08-04", status: "pending", amount: 0.1, createdBy: "staff" },
    { id: "b", fundId: "a", type: "income", paymentMethod: "transfer", transactionDate: "2026-08-04", status: "approved", amount: 0.2, createdBy: "other" },
    { id: "c", fundId: "b", type: "income", paymentMethod: "transfer", transactionDate: "2026-08-04", status: "pending", amount: 9, createdBy: "staff" },
  ];
  const filters = { fundId: "a", date: "2026-08-04", uid: "staff" };
  assert.deepEqual(receiptRows(rows, { ...filters, isOwner: false }).map((row) => row.id), ["a"]);
  const selected = receiptRows(rows, { ...filters, isOwner: true });
  assert.deepEqual(receiptTotals(selected), { pending: { count: 1, satang: 10 }, approved: { count: 1, satang: 20 } });
});

test("queue saves twenty entries in FIFO order without parallel writes and retains failures for retry", async () => {
  let items = Array.from({ length: 20 }, (_, id) => ({ id, state: "queued" }));
  const saved = new Set();
  const order = [];
  let active = 0;
  const update = (fn) => { items = fn(items); };
  const save = async (item) => {
    active += 1;
    assert.equal(active, 1);
    order.push(item.id);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    if (item.id === 3 && !item.attempted) {
      saved.add(item.id);
      throw new Error("จำลองไม่ได้รับผลตอบกลับหลังบันทึก");
    }
    if (!saved.has(item.id)) saved.add(item.id);
  };
  const oldError = console.error;
  console.error = () => {};
  try { await drainReceiptQueue({ getItems: () => items, update, save }); }
  finally { console.error = oldError; }
  assert.deepEqual(order, Array.from({ length: 20 }, (_, id) => id));
  assert.equal(items.length, 1);
  assert.equal(items[0].state, "failed");
  update((current) => current.map((item) => ({ ...item, state: "queued" })));
  await drainReceiptQueue({ getItems: () => items, update, save });
  assert.equal(saved.size, 20);
  assert.equal(items.length, 0);
});
