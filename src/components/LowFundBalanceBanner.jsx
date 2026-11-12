import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { formatBaht } from "../lib/format";
import { currentFundBalance } from "../lib/ledger";

// เตือนเมื่องบค่าใช้จ่ายคงเหลือต่ำกว่า 20% ของยอดตั้งต้น — ปรับตัวเลขนี้ได้ถ้าต้องการเกณฑ์อื่น
const LOW_BALANCE_RATIO = 0.2;

export default function LowFundBalanceBanner() {
  const [funds, setFunds] = useState([]);
  const [topups, setTopups] = useState([]);
  const [approvedTx, setApprovedTx] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "funds"), (snap) =>
      setFunds(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub2 = onSnapshot(collection(db, "fundTopups"), (snap) =>
      setTopups(snap.docs.map((d) => d.data()))
    );
    const unsub3 = onSnapshot(query(collection(db, "transactions"), where("status", "==", "approved")), (snap) =>
      setApprovedTx(snap.docs.map((d) => d.data()))
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  const lowFunds = funds
    .map((f) => ({ ...f, balance: currentFundBalance(f, topups, approvedTx) }))
    .filter((f) => f.openingBalance > 0 && f.balance < f.openingBalance * LOW_BALANCE_RATIO);

  if (lowFunds.length === 0) return null;

  return (
    <div role="status" className="mb-6 rounded-xl border border-amber/50 bg-amber-light px-4 py-3 text-sm text-amber">
      <div className="mb-1 font-semibold">เงินหมุนเวียนใกล้หมด</div>
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
