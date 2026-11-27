import { bangkokDate, parseBangkokDate } from "./businessDate.js";
import { isActiveTopup } from "./cashStatus.js";

function timestampDate(value) {
  if (!value) return null;
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : bangkokDate(date);
}

export function dashboardTransactionDate(transaction) {
  if (transaction.transactionDate != null) {
    return parseBangkokDate(transaction.transactionDate) ? transaction.transactionDate : null;
  }
  return timestampDate(transaction.createdAt);
}

export function dashboardTopupDate(topup) {
  return timestampDate(topup.topupDate ?? topup.createdAt);
}

export function dashboardMonths(endMonth, count = 6) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth)) return [];
  const [year, month] = endMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - index - 1), 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleDateString("th-TH", { timeZone: "UTC", month: "short", year: "2-digit" }),
      income: 0,
      expense: 0,
    };
  });
}

export function calculateFundDashboard(fund, topups, transactions, month) {
  const months = dashboardMonths(month);
  if (!months.length) throw new Error("Invalid dashboard month");
  const monthly = new Map(months.map((item) => [item.key, item]));
  let opening = Number(fund.openingBalance);
  let invalidCount = 0;
  if (!Number.isFinite(opening)) throw new Error("Invalid fund opening balance");
  let topup = 0;
  let income = 0;
  let expense = 0;

  function add(date, amount, kind) {
    if (!date || amount == null || !Number.isFinite(Number(amount))) {
      invalidCount += 1;
      return;
    }
    const value = Number(amount);
    const key = date.slice(0, 7);
    if (key < month) opening += kind === "expense" ? -value : value;
    if (key === month) {
      if (kind === "topup") topup += value;
      if (kind === "income") income += value;
      if (kind === "expense") expense += value;
    }
    const point = monthly.get(key);
    if (point) point[kind === "expense" ? "expense" : "income"] += value;
  }

  topups.filter((item) => item.fundId === fund.id && isActiveTopup(item))
    .forEach((item) => add(dashboardTopupDate(item), item.amount, "topup"));
  transactions.filter((item) => item.fundId === fund.id && item.status === "approved" &&
    (item.type === "income" || item.type === "expense"))
    .forEach((item) => add(dashboardTransactionDate(item), item.amount, item.type));
  return { opening, topup, income, expense, received: topup + income, balance: opening + topup + income - expense, months, invalidCount };
}
