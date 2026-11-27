import { formatBusinessDate } from "./businessDate.js";

export function formatBaht(n) {
  const num = Number(n || 0);
  return num.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTime(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return `${formatDate(d)} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export function formatDate(ts) {
  if (!ts) return "-";
  if (typeof ts === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ts)) return formatBusinessDate(ts);
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH-u-ca-buddhist-nu-latn", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const STATUS_LABEL = {
  pending: "รอตรวจสอบ",
  needs_evidence: "รอหลักฐาน",
  approved: "อนุมัติแล้ว",
  rejected: "ตีกลับ",
  voided: "ยกเลิกรายการ",
};

export const TYPE_LABEL = {
  income: "รายรับ",
  expense: "รายจ่าย",
};

export const PAYMENT_LABEL = {
  cash: "เงินสด",
  transfer: "โอนเงิน",
};

