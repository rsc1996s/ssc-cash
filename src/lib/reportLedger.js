import { bangkokDate, parseBangkokDate } from "./businessDate.js";
import { dashboardTopupDate, dashboardTransactionDate } from "./dashboardCash.js";
import { buildFundLedger } from "./ledger.js";
import { isActiveTopup } from "./cashStatus.js";

export function localCalendarDate(value) {
  if (!parseBangkokDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function reportToday() {
  return localCalendarDate(bangkokDate());
}

export function reportTransactionDate(transaction) {
  return localCalendarDate(dashboardTransactionDate(transaction));
}

export function buildBusinessDateLedger(fund, topups, transactions) {
  let invalidCount = 0;
  const datedTopups = topups.filter((item) => item.fundId === fund.id && isActiveTopup(item)).flatMap((item) => {
    const date = localCalendarDate(dashboardTopupDate(item));
    if (!date) {
      invalidCount += 1;
      return [];
    }
    return [{ ...item, createdAt: date }];
  });
  const datedTransactions = transactions.filter((item) => item.fundId === fund.id && item.status === "approved").flatMap((item) => {
    const date = reportTransactionDate(item);
    if (!date) {
      invalidCount += 1;
      return [];
    }
    return [{ ...item, reviewedAt: date }];
  });
  return { ledger: buildFundLedger(fund, datedTopups, datedTransactions), invalidCount };
}
