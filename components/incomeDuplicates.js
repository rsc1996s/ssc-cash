import { dashboardTopupDate, dashboardTransactionDate } from "../lib/dashboardCash.js";
import { parseBangkokDate } from "../lib/businessDate.js";
import { isActiveTopup } from "../lib/cashStatus.js";

function isRelevantIncome(entry) {
  return entry.type === "income" && ["pending", "needs_evidence", "approved"].includes(entry.status);
}

function matches(entry, draft, getDate) {
  const amount = Number(draft.amount);
  return Boolean(draft.fundId) && Boolean(parseBangkokDate(draft.date)) &&
    Number.isFinite(amount) && amount > 0 &&
    entry.fundId === draft.fundId && Number(entry.amount) === amount &&
    getDate(entry) === draft.date;
}

export function matchingTopups(draft, topups) {
  return topups.filter((entry) => isActiveTopup(entry) && matches(entry, draft, dashboardTopupDate));
}

export function matchingIncomeTransactions(draft, transactions) {
  return transactions.filter((entry) =>
    isRelevantIncome(entry) && matches(entry, draft, dashboardTransactionDate));
}

export function possibleIncomeDuplicateGroups(topups, transactions) {
  const groups = new Map();
  function add(entry, date, kind) {
    const amount = Number(entry.amount);
    if (!entry.fundId || !parseBangkokDate(date) || !Number.isFinite(amount) || amount <= 0) return;
    const key = JSON.stringify([entry.fundId, date, amount]);
    if (!groups.has(key)) groups.set(key, { key, fundId: entry.fundId, date, amount, topups: [], incomes: [] });
    groups.get(key)[kind].push(entry);
  }
  topups.filter(isActiveTopup).forEach((entry) => add(entry, dashboardTopupDate(entry), "topups"));
  transactions.filter(isRelevantIncome).forEach((entry) => add(entry, dashboardTransactionDate(entry), "incomes"));
  return [...groups.values()].filter((group) => group.topups.length && group.incomes.length)
    .sort((a, b) => b.date.localeCompare(a.date));
}
