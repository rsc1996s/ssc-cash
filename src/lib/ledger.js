function toDate(ts) {
  if (!ts) return new Date(0);
  return ts.toDate ? ts.toDate() : new Date(ts);
}

/**
 * Builds the full chronological ledger for one fund: opening balance,
 * every top-up (+), and every APPROVED transaction (+income / -expense).
 * Pending/rejected/voided transactions never move the fund balance —
 * only money that actually left/entered the till counts.
 */
export function buildFundLedger(fund, topups, transactions) {
  const entries = [];

  topups
    .filter((t) => t.fundId === fund.id)
    .forEach((t) => {
      entries.push({
        date: toDate(t.createdAt),
        kind: "topup",
        label: "เงินรับเข้ากองทุน",
        detail: t.note || "-",
        amount: t.amount,
        by: t.createdByName,
      });
    });

  transactions
    .filter((t) => t.fundId === fund.id && t.status === "approved")
    .forEach((t) => {
      entries.push({
        date: toDate(t.reviewedAt || t.createdAt),
        kind: t.type,
        label: t.type === "income" ? "รายรับ" : "รายจ่าย",
        detail: t.itemDescription,
        category: t.category || null,
        amount: t.type === "income" ? t.amount : -t.amount,
        by: t.createdByName,
        ref: t.id,
      });
    });

  entries.sort((a, b) => a.date - b.date);

  let running = fund.openingBalance || 0;
  return entries.map((e) => {
    running += e.amount;
    return { ...e, balance: running };
  });
}

export function currentFundBalance(fund, topups, transactions) {
  const ledger = buildFundLedger(fund, topups, transactions);
  return ledger.length ? ledger[ledger.length - 1].balance : fund.openingBalance || 0;
}

/**
 * Slices a full ledger down to [start, end] (inclusive), and returns the
 * brought-forward balance (everything before start) plus the entries and
 * closing balance for that window — the shape a printed statement needs.
 */
export function statementForRange(ledger, start, end, fundOpeningBalance = 0) {
  const before = ledger.filter((e) => e.date < start);
  const within = ledger.filter((e) => e.date >= start && e.date <= end);
  const openingBalance = before.length ? before[before.length - 1].balance : fundOpeningBalance;
  const closingBalance = within.length ? within[within.length - 1].balance : openingBalance;
  const totalIn = within.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalOut = within.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  return { openingBalance, entries: within, closingBalance, totalIn, totalOut };
}
