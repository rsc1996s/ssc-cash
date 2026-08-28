export function formatBaht(n) {
  const num = Number(n || 0);
  return num.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTime(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("th-TH", { dateStyle: "medium" });
}

export const STATUS_LABEL = {
  pending: "รอตรวจสอบ",
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
