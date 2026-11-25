import assert from "node:assert/strict";
import { test } from "node:test";
import { remainingBalance, transferredAgainst } from "../src/lib/transfers.js";

test("withdrawal balance uses actual receipts and all linked payments", () => {
  const withdrawal = { id: "w1", totalAmount: 52399, receivedAmount: 52400 };
  const payments = [
    { linkedWithdrawalRequestId: "w1", lines: [{ amount: 50000 }] },
    { linkedWithdrawalRequestId: "w2", lines: [{ amount: 100 }] },
  ];
  assert.equal(remainingBalance(withdrawal, payments), 2400);
  assert.equal(transferredAgainst("w1", payments), 50000);
  payments.push({ linkedWithdrawalRequestId: "w1", lines: [{ amount: 2500 }] });
  assert.equal(remainingBalance(withdrawal, payments), -100);
});

test("legacy withdrawals have no assumed receipt", () => {
  assert.equal(remainingBalance({ id: "w1", totalAmount: 52399 }, []), null);
  assert.equal(remainingBalance({ id: "w1", receivedAmount: 0 }, []), 0);
});
