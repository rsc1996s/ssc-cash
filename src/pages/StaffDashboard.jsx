import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import LowFundBalanceBanner from "../components/LowFundBalanceBanner";
import { formatBaht, formatDateTime, TYPE_LABEL, PAYMENT_LABEL } from "../lib/format";

export default function StaffDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "transactions"),
      where("createdBy", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const totalIn = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);

  return (
    <Layout>
      <LowFundBalanceBanner />

      {/* Ledger tape summary */}
      <div className="bg-ink text-paper rounded-lg px-5 py-4 mb-6 font-nums flex justify-between text-sm">
        <div>
          <div className="text-paper/60 text-xs mb-1">รายรับรวม</div>
          <div className="text-teal-light text-lg">{formatBaht(totalIn)}</div>
        </div>
        <div>
          <div className="text-paper/60 text-xs mb-1">รายจ่ายรวม</div>
          <div className="text-amber text-lg">{formatBaht(totalOut)}</div>
        </div>
        <div>
          <div className="text-paper/60 text-xs mb-1">คงเหลือสุทธิ</div>
          <div className="text-lg">{formatBaht(totalIn - totalOut)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h1 className="font-slab text-lg">รายการของฉัน</h1>
        <Link to="/new" className="text-sm bg-teal text-white rounded px-3 py-1.5 font-medium">
          + บันทึกใหม่
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-inkSoft">ยังไม่มีรายการ กดปุ่ม "+ บันทึกใหม่" เพื่อเริ่มบันทึก</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-paperLine rounded-lg p-4 receipt-edge hover:border-teal flex items-center gap-3"
            >
              <Link to={`/transaction/${r.id}`} className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-inkSoft mb-1">
                      {r.fundLabel} · {TYPE_LABEL[r.type]} · {PAYMENT_LABEL[r.paymentMethod]}
                    </div>
                    <div className="font-medium">{r.itemDescription}</div>
                    <div className="text-xs text-inkSoft mt-1">{formatDateTime(r.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-nums text-lg ${
                        r.type === "income" ? "text-teal" : "text-rust"
                      }`}
                    >
                      {r.type === "income" ? "+" : "-"}
                      {formatBaht(r.amount)}
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                </div>
              </Link>
              {r.status === "approved" && (
                <Link
                  to={`/transaction/${r.id}/print`}
                  target="_blank"
                  className="shrink-0 text-xs border border-paperLine rounded px-3 py-2 hover:border-teal hover:text-teal"
                >
                  พิมพ์
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
