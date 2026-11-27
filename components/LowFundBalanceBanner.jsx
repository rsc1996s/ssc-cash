import { useAuth } from "../context/AuthContext";
import useScopedCashData from "../hooks/useScopedCashData";
import { formatBaht } from "../lib/format";
import { currentFundBalance } from "../lib/ledger";
import { isActiveFund } from "../lib/cashStatus";

// เตือนเมื่องบค่าใช้จ่ายคงเหลือต่ำกว่า 20% ของยอดตั้งต้น — ปรับตัวเลขนี้ได้ถ้าต้องการเกณฑ์อื่น
const LOW_BALANCE_RATIO = 0.2;

export default function LowFundBalanceBanner() {
  const { funds, topups, transactions: approvedTx, error } = useScopedCashData();
  const { isOwner } = useAuth();

  if (error) return <p role="alert" className="mb-4 text-sm text-danger">โหลดข้อมูลงบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ</p>;

  const lowFunds = funds
    .filter(isActiveFund)
    .map((f) => ({ ...f, balance: currentFundBalance(f, topups, approvedTx) }))
    .filter((f) => f.openingBalance > 0 && f.balance < f.openingBalance * LOW_BALANCE_RATIO);

  if (lowFunds.length === 0) return null;

  return (
    <div role="status" className="mb-6 rounded-xl border border-warning/50 bg-warning-light px-4 py-3 text-sm text-warning">
      <div className="mb-1 font-semibold">เงินหมุนเวียนใกล้หมด{!isOwner && " · งบที่คุณดูแล"}</div>
      <ul className="space-y-0.5">
        {lowFunds.map((f) => (
          <li key={f.id}>
            <span className="font-medium">{f.label}</span> เหลือ{" "}
            <span className="font-nums">{formatBaht(f.balance)}</span> บาท (จากยอดตั้งต้น{" "}
            <span className="font-nums">{formatBaht(f.openingBalance)}</span> บาท) — ควรเติมเงินเข้างบค่าใช้จ่ายเร็วๆ นี้
          </li>
        ))}
      </ul>
    </div>
  );
}
