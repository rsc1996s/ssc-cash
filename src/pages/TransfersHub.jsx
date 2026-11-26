import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { formatBaht, formatDate } from "../lib/format";
import { remainingBalance, lineTotal } from "../lib/transfers";
import SegmentedTabs from "../components/ui/SegmentedTabs";

export default function TransfersHub() {
  const { isOwner } = useAuth();
  const [tab, setTab] = useState("withdrawals");
  const [withdrawals, setWithdrawals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "withdrawalRequests"), (snap) =>
      setWithdrawals(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      )
    );
    // พนักงานอ่าน transferPayments ไม่ได้ (สิทธิ์เจ้าของร้านเท่านั้น) จึงข้ามการฟังคอลเลกชันนี้ไปเลย
    const unsub2 = isOwner
      ? onSnapshot(collection(db, "transferPayments"), (snap) =>
          setPayments(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
          )
        )
      : () => {};
    return () => {
      unsub1();
      unsub2();
    };
  }, [isOwner]);

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{isOwner ? "โอนจ่าย" : "ใบเบิกเงินโอน"}</h1>
          <p className="mt-1 text-sm text-inkSoft">จัดการใบเบิกและเอกสารโอนจ่าย</p>
        </div>
        <Link to={(!isOwner || tab === "withdrawals") ? "/transfers/withdrawals/new" : "/transfers/payments/new"}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark">
          {(!isOwner || tab === "withdrawals") ? "+ สร้างใบเบิกใหม่" : "+ สร้างใบโอนจ่ายใหม่"}
        </Link>
      </div>

      {isOwner && (
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          ariaLabel="ประเภทเอกสารโอน"
          className="mb-4"
          options={[
            { value: "withdrawals", label: "ใบเบิกเงินโอน" },
            { value: "payments", label: "ใบโอนจ่าย" },
          ]}
        />
      )}

      {(!isOwner || tab === "withdrawals") ? (
        <>
          {withdrawals.length === 0 ? (
            <p className="rounded-xl border border-paperLine bg-white p-4 text-sm text-inkSoft">ยังไม่มีใบเบิก เลือกสร้างใบเบิกใหม่เพื่อเริ่มต้น</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.slice(0, visibleCount).map((w) => {
                const total = w.totalAmount ?? lineTotal(w.lines);
                const remain = isOwner ? remainingBalance(w, payments) : null;
                return (
                  <div
                    key={w.id}
                    className="bg-white border border-paperLine rounded-lg p-4 hover:border-primary flex items-center gap-3"
                  >
                    <Link to={`/transfers/withdrawals/${w.id}`} className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-nums text-sm text-inkSoft mb-1">{w.requestNo}</div>
                          <div className="font-medium">{w.sourceAccountLabel}</div>
                          <div className="text-xs text-inkSoft mt-1">
                            {formatDate(w.date)} · {(w.lines || []).length} รายการ
                            {!isOwner && w.createdByName ? ` · โดย ${w.createdByName}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-nums text-lg">{formatBaht(total)}</div>
                          {isOwner && (
                            <div
                              className={`text-xs font-nums mt-1 ${
                                remain <= 0 ? "text-primary" : "text-warning"
                              }`}
                            >
                              {remain === null ? "ยังไม่ได้ระบุยอดรับจริง" : `คงเหลือ ${formatBaht(remain)}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                    <Link
                      to={`/transfers/withdrawals/${w.id}/print`}
                      target="_blank"
                      className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-paperLine px-3 text-xs hover:border-primary hover:text-primary"
                    >
                      พิมพ์
                    </Link>
                  </div>
                );
              })}
              {withdrawals.length > visibleCount && (
                <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="w-full rounded-lg border border-paperLine bg-white py-3 text-sm text-blue-700">
                  ดูเพิ่มเติม ({withdrawals.length - visibleCount})
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {payments.length === 0 ? (
            <p className="rounded-xl border border-paperLine bg-white p-4 text-sm text-inkSoft">ยังไม่มีใบโอนจ่าย เลือกสร้างใบโอนจ่ายใหม่เพื่อเริ่มต้น</p>
          ) : (
            <div className="space-y-3">
              {payments.slice(0, visibleCount).map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-paperLine rounded-lg p-4 hover:border-primary flex items-center gap-3"
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
                      <div className="font-nums text-lg text-danger">
                        -{formatBaht(lineTotal(p.lines))}
                      </div>
                    </div>
                  </Link>
                  <Link
                    to={`/transfers/payments/${p.id}/print`}
                    target="_blank"
                    className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-paperLine px-3 text-xs hover:border-primary hover:text-primary"
                  >
                    พิมพ์
                  </Link>
                </div>
              ))}
              {payments.length > visibleCount && (
                <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="w-full rounded-lg border border-paperLine bg-white py-3 text-sm text-blue-700">
                  ดูเพิ่มเติม ({payments.length - visibleCount})
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
