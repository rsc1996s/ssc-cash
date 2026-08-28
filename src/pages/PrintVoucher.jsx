import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { formatBaht, formatDateTime, TYPE_LABEL, PAYMENT_LABEL } from "../lib/format";

export default function PrintVoucher() {
  const { id } = useParams();
  const [tx, setTx] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "transactions", id), (snap) => {
      if (snap.exists()) setTx({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [id]);

  if (!tx) {
    return <p className="p-6 text-sm text-inkSoft">กำลังโหลด...</p>;
  }

  if (tx.status !== "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-4">
        <div className="text-center">
          <p className="text-sm text-inkSoft mb-3">
            รายการนี้ยังไม่ได้รับการอนุมัติและเซ็นยืนยัน จึงยังพิมพ์ใบเบิกไม่ได้
          </p>
          <Link to={`/transaction/${id}`} className="text-teal text-sm font-medium">
            กลับไปหน้ารายการ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-8 px-4">
      <div className="no-print max-w-2xl mx-auto mb-4 flex justify-between">
        <Link to={`/transaction/${id}`} className="text-sm text-inkSoft">
          ← กลับ
        </Link>
        <button
          onClick={() => window.print()}
          className="bg-teal text-white rounded px-4 py-2 text-sm font-medium"
        >
          พิมพ์ / บันทึกเป็น PDF
        </button>
      </div>

      <div className="print-sheet max-w-2xl mx-auto bg-white border border-paperLine rounded-lg p-8">
        <div className="flex justify-between items-start border-b border-ink pb-4 mb-6">
          <div>
            <h1 className="font-slab text-2xl">ใบเบิกเงินสด</h1>
            <p className="text-sm text-inkSoft">{tx.fundLabel}</p>
          </div>
          <div className="text-right text-sm">
            <div className="text-inkSoft">เลขที่อ้างอิง</div>
            <div className="font-nums">{tx.id}</div>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <tbody>
            <tr className="border-b border-paperLine">
              <td className="py-2 text-inkSoft w-1/3">ประเภทรายการ</td>
              <td className="py-2 text-right">{TYPE_LABEL[tx.type]}</td>
            </tr>
            <tr className="border-b border-paperLine">
              <td className="py-2 text-inkSoft">รายละเอียด</td>
              <td className="py-2 text-right">{tx.itemDescription}</td>
            </tr>
            {tx.type === "expense" && (
              <tr className="border-b border-paperLine">
                <td className="py-2 text-inkSoft">เบิกเงินไป</td>
                <td className="py-2 text-right font-nums">{formatBaht(tx.withdrawnAmount)} บาท</td>
              </tr>
            )}
            <tr className="border-b border-paperLine">
              <td className="py-2 text-inkSoft">จำนวนเงิน</td>
              <td className="py-2 text-right font-nums font-semibold">
                {formatBaht(tx.amount)} บาท
              </td>
            </tr>
            {tx.type === "expense" && (
              <tr className="border-b border-paperLine">
                <td className="py-2 text-inkSoft">เงินทอน</td>
                <td className="py-2 text-right font-nums">{formatBaht(tx.changeAmount)} บาท</td>
              </tr>
            )}
            <tr className="border-b border-paperLine">
              <td className="py-2 text-inkSoft">ช่องทางชำระเงิน</td>
              <td className="py-2 text-right">{PAYMENT_LABEL[tx.paymentMethod]}</td>
            </tr>
            <tr className="border-b border-paperLine">
              <td className="py-2 text-inkSoft">ผู้บันทึกรายการ</td>
              <td className="py-2 text-right">{tx.createdByName}</td>
            </tr>
            <tr className="border-b border-paperLine">
              <td className="py-2 text-inkSoft">วันที่บันทึก</td>
              <td className="py-2 text-right">{formatDateTime(tx.createdAt)}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 pt-4">
          <div>
            <div className="text-xs text-inkSoft mb-2">ลงชื่อผู้เบิก</div>
            <div className="border-b border-ink h-10" />
            <div className="text-xs text-inkSoft mt-1">{tx.createdByName}</div>
          </div>
          <div>
            <div className="text-xs text-inkSoft mb-2">ลงชื่อผู้อนุมัติ</div>
            {tx.approvalSignatureURL ? (
              <img src={tx.approvalSignatureURL} alt="ลายเซ็นผู้อนุมัติ" className="h-10" />
            ) : (
              <div className="border-b border-ink h-10" />
            )}
            <div className="text-xs text-inkSoft mt-1">
              {tx.reviewedByName} · {formatDateTime(tx.reviewedAt)}
            </div>
          </div>
        </div>

        {tx.reviewNote && (
          <p className="text-xs text-inkSoft mt-6 border-t border-paperLine pt-3">
            หมายเหตุการอนุมัติ: {tx.reviewNote}
          </p>
        )}

        <p className="text-xs text-inkSoft mt-6 border-t border-paperLine pt-3">
          เอกสารนี้พิมพ์จากระบบบันทึกรายรับ-รายจ่ายเงินสดหน้าร้าน ถือเป็นหลักฐานการเบิก-จ่ายเงินที่ผ่านการอนุมัติแล้ว
        </p>
      </div>
    </div>
  );
}
