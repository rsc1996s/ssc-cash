import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { formatBaht, formatDate, formatDateTime } from "../lib/format";
import { lineTotal } from "../lib/transfers";

export default function WithdrawalRequestPrint() {
  const { id } = useParams();
  const [w, setW] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "withdrawalRequests", id), (snap) => {
      if (snap.exists()) setW({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [id]);

  if (!w) return <div className="p-8 text-inkSoft">กำลังโหลด...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 font-sans text-ink">
      <div className="no-print flex justify-end mb-4">
        <button onClick={() => window.print()} className="bg-teal text-white rounded px-4 py-2 text-sm font-medium">
          พิมพ์เอกสาร / บันทึก PDF
        </button>
      </div>

      <div className="border-2 border-ink rounded-lg p-6">
        <div className="text-center mb-6">
          <h1 className="font-slab text-xl">ใบเบิกเงินโอน</h1>
          <p className="text-sm text-inkSoft font-nums">{w.requestNo}</p>
        </div>

        <table className="w-full text-sm mb-6">
          <tbody>
            <tr>
              <td className="py-1 text-inkSoft w-44">รับโอนเข้าบัญชี</td>
              <td className="py-1">{w.sourceAccountLabel}</td>
            </tr>
            <tr>
              <td className="py-1 text-inkSoft">วันที่เบิก</td>
              <td className="py-1">{formatDate(w.date)}</td>
            </tr>
            <tr>
              <td className="py-1 text-inkSoft">ผู้จัดทำ</td>
              <td className="py-1">{w.createdByName}</td>
            </tr>
            {w.note && (
              <tr>
                <td className="py-1 text-inkSoft">หมายเหตุ</td>
                <td className="py-1">{w.note}</td>
              </tr>
            )}
          </tbody>
        </table>

        <table className="w-full text-sm mb-4 border-t border-b border-paperLine">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-paperLine">
              <th className="py-2 w-10">#</th>
              <th className="py-2 w-40">หมวดหมู่</th>
              <th className="py-2">รายละเอียด</th>
              <th className="py-2 text-right w-28">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {(w.lines || []).map((l, i) => (
              <tr key={i} className="border-b border-paperLine/60">
                <td className="py-2 font-nums">{l.lineNo || i + 1}</td>
                <td className="py-2">{l.categoryLabel || "-"}</td>
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right font-nums">{formatBaht(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="text-right">
            <div className="text-xs text-inkSoft">ยอดเบิกรวม</div>
            <div className="font-nums text-lg font-semibold">
              {formatBaht(w.totalAmount ?? lineTotal(w.lines))} บาท
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-10 text-sm">
          <div className="text-center">
            <div className="h-14"></div>
            <div className="border-t border-ink pt-1">ผู้เบิก</div>
            <div className="text-inkSoft">{w.createdByName}</div>
          </div>
          <div className="text-center">
            <div className="h-14"></div>
            <div className="border-t border-ink pt-1">ผู้อนุมัติ</div>
            <div className="text-inkSoft">&nbsp;</div>
          </div>
        </div>

        <p className="text-xs text-inkSoft text-center mt-6">พิมพ์เมื่อ {formatDateTime(new Date())}</p>
      </div>
    </div>
  );
}
