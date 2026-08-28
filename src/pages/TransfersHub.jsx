import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import { formatBaht, formatDate } from "../lib/format";
import { remainingBalance, lineTotal } from "../lib/transfers";

export default function TransfersHub() {
  const [tab, setTab] = useState("withdrawals");
  const [withdrawals, setWithdrawals] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "withdrawalRequests"), (snap) =>
      setWithdrawals(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      )
    );
    const unsub2 = onSnapshot(collection(db, "transferPayments"), (snap) =>
      setPayments(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      )
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="font-slab text-lg">โอนจ่าย (ไม่ใช่เงินสด)</h1>
        <Link to="/transfers/accounts" className="text-sm border border-paperLine rounded px-3 py-1.5">
          บัญชีธนาคาร & หมวดหมู่
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("withdrawals")}
          className={`text-sm rounded-full px-4 py-1.5 border ${
            tab === "withdrawals" ? "bg-ink text-white border-ink" : "border-paperLine text-inkSoft"
          }`}
        >
          ใบเบิกเงินโอน
        </button>
        <button
          onClick={() => setTab("payments")}
          className={`text-sm rounded-full px-4 py-1.5 border ${
            tab === "payments" ? "bg-ink text-white border-ink" : "border-paperLine text-inkSoft"
          }`}
        >
          ใบโอนจ่าย
        </button>
      </div>

      {tab === "withdrawals" ? (
        <>
          <div className="flex justify-end mb-3">
            <Link to="/transfers/withdrawals/new" className="text-sm bg-teal text-white rounded px-3 py-1.5 font-medium">
              + สร้างใบเบิกใหม่
            </Link>
          </div>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-inkSoft">ยังไม่มีใบเบิก</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const total = w.totalAmount ?? lineTotal(w.lines);
                const remain = remainingBalance(w, payments);
                return (
                  <div
                    key={w.id}
                    className="bg-white border border-paperLine rounded-lg p-4 receipt-edge hover:border-teal flex items-center gap-3"
                  >
                    <Link to={`/transfers/withdrawals/${w.id}`} className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-nums text-sm text-inkSoft mb-1">{w.requestNo}</div>
                          <div className="font-medium">{w.sourceAccountLabel}</div>
                          <div className="text-xs text-inkSoft mt-1">
                            {formatDate(w.date)} · {(w.lines || []).length} รายการ
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-nums text-lg">{formatBaht(total)}</div>
                          <div
                            className={`text-xs font-nums mt-1 ${
                              remain <= 0 ? "text-teal" : "text-amber"
                            }`}
                          >
                            {remain <= 0 ? "ตัดยอดครบแล้ว" : `คงเหลือ ${formatBaht(remain)}`}
                          </div>
                        </div>
                      </div>
                    </Link>
                    <Link
                      to={`/transfers/withdrawals/${w.id}/print`}
                      target="_blank"
                      className="shrink-0 text-xs border border-paperLine rounded px-3 py-2 hover:border-teal hover:text-teal"
                    >
                      พิมพ์
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <Link to="/transfers/payments/new" className="text-sm bg-teal text-white rounded px-3 py-1.5 font-medium">
              + สร้างใบโอนจ่ายใหม่
            </Link>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-inkSoft">ยังไม่มีใบโอนจ่าย</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-paperLine rounded-lg p-4 receipt-edge hover:border-teal flex items-center gap-3"
                >
                  <Link to={`/transfers/payments/${p.id}`} className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-nums text-sm text-inkSoft mb-1">{p.transferNo}</div>
                        <div className="font-medium">{p.sourceAccountLabel}</div>
                        <div className="text-xs text-inkSoft mt-1">
                          ตัดกับใบเบิก {p.linkedWithdrawalRequestNo} · {(p.lines || []).length} รายการ
                        </div>
                      </div>
                      <div className="font-nums text-lg text-rust">
                        -{formatBaht(lineTotal(p.lines))}
                      </div>
                    </div>
                  </Link>
                  <Link
                    to={`/transfers/payments/${p.id}/print`}
                    target="_blank"
                    className="shrink-0 text-xs border border-paperLine rounded px-3 py-2 hover:border-teal hover:text-teal"
                  >
                    พิมพ์
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
