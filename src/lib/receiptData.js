import { parseSatang, sumSatang } from "./money.js";
import { dashboardTransactionDate } from "./dashboardCash.js";

const PREFIX = "รับโอนจากลูกค้า";

export function receiptDescription(customer) {
  const name = customer.trim();
  const value = name ? `${PREFIX}: ${name}` : PREFIX;
  if (value.length > 1000) throw new Error("ชื่อลูกค้ายาวเกินกำหนด");
  return value;
}

export function receiptCustomer(description) {
  return description?.startsWith(`${PREFIX}: `) ? description.slice(PREFIX.length + 2).trim() : "";
}

export function receiptRows(transactions, { fundId, date, isOwner, uid }) {
  return transactions.filter((item) => item.type === "income" && item.paymentMethod === "transfer" &&
    item.fundId === fundId && dashboardTransactionDate(item) === date &&
    (isOwner || item.createdBy === uid))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

export function receiptTotals(rows) {
  return Object.fromEntries(["pending", "approved"].map((status) => {
    const matching = rows.filter((item) => item.status === status);
    return [status, { count: matching.length, satang: sumSatang(matching.map((item) => {
      parseSatang(item.amount);
      return item.amount;
    })) }];
  }));
}
