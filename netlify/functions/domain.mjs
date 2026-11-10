function toCents(value, fieldName) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(amount - cents / 100) > 0.0000001) {
    throw new TypeError(`${fieldName} must have at most two decimal places`);
  }
  return cents;
}

function timestampMillis(value) {
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Number.NaN;
}

function calculateCashBalance(fund, topups, transactions, asOf) {
  const cutoff = timestampMillis(asOf);
  if (!Number.isFinite(cutoff)) throw new TypeError("asOf must be a valid timestamp");

  let balanceCents = toCents(fund.openingBalance || 0, "openingBalance");
  topups.forEach((topup) => {
    const createdAt = timestampMillis(topup.createdAt);
    if (topup.fundId === fund.id && createdAt <= cutoff) {
      balanceCents += toCents(topup.amount, "topup.amount");
    }
  });
  transactions.forEach((transaction) => {
    const occurredAt = timestampMillis(transaction.reviewedAt || transaction.createdAt);
    if (
      transaction.fundId !== fund.id ||
      transaction.status !== "approved" ||
      transaction.paymentMethod !== "cash" ||
      occurredAt > cutoff
    ) return;

    const amountCents = toCents(transaction.amount, "transaction.amount");
    if (transaction.type === "income") balanceCents += amountCents;
    else if (transaction.type === "expense") balanceCents -= amountCents;
  });

  if (!Number.isSafeInteger(balanceCents)) {
    throw new RangeError("Calculated cash balance exceeds the supported range");
  }
  return balanceCents / 100;
}

function validateBusinessDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("businessDate must use YYYY-MM-DD");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) throw new TypeError("businessDate is not a valid date");
  return value;
}

function bangkokBusinessDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function canCloseDailyFund(profile) {
  return Boolean(
    profile &&
    profile.disabled !== true &&
    (profile.role === "owner" || profile.role === "staff")
  );
}

export {
  bangkokBusinessDate,
  calculateCashBalance,
  canCloseDailyFund,
  toCents,
  validateBusinessDate,
};
