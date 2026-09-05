import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import LowFundBalanceBanner from "../components/LowFundBalanceBanner";
import { formatBaht, formatDateTime, TYPE_LABEL } from "../lib/format";

const STATUS_FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "pending", label: "รอตรวจสอบ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ตีกลับ" },
  { key: "voided", label: "ยกเลิก" },
];

export default function OwnerDashboard() {
  const [rows, setRows] = useState([]);
  const [funds, setFunds] = useState({});
  const [statusFilter, setStatusFilter] = useState("pending");
  const [staffFilter, setStaffFilter] = useState("all");
  const [fundFilter, setFundFilter] = useState("all");

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubFunds = onSnapshot(collection(db, "funds"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => (map[d.id] = d.data().label));
      setFunds(map);
    });
    return () => {
      unsub();
      unsubFunds();
    };
  }, []);

  const staffNames = Array.from(new Set(rows.map((r) => r.createdByName))).sort();

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (staffFilter !== "all" && r.createdByName !== staffFilter) return false;
    if (fundFilter !== "all" && r.fundId !== fundFilter) return false;
    return true;
  });

  const totalIn = rows
    .filter((r) => r.type === "income" && r.status !== "voided" && r.status !== "rejected")
    .reduce((s, r) => s + r.amount, 0);
  const totalOut = rows
    .filter((r) => r.type === "expense" && r.status !== "voided" && r.status !== "rejected")
    .reduce((s, r) => s + r.amount, 0);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <Layout>
      <LowFundBalanceBanner />

      <div className="bg-ink text-paper rounded-lg px-5 py-4 mb-6 font-nums flex justify-between text-sm">
        <div>
          <div className="text-paper/60 text-xs mb-1">รายรับรวม (ไม่รวมตีกลับ/ยกเลิก)</div>
          <div className="text-teal-light text-lg">{formatBaht(totalIn)}</div>
        </div>
        <div>
          <div className="text-paper/60 text-xs mb-1">รายจ่ายรวม</div>
          <div className="text-amber text-lg">{formatBaht(totalOut)}</div>
        </div>
        <div>
          <div className="text-paper/60 text-xs mb-1">รอตรวจสอบ</div>
          <div className="text-lg">{pendingCount} รายการ</div>
        </div>
      </div>

      <h1 className="font-slab text-lg mb-3">ตรวจสอบรายการทั้งหมด</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              statusFilter === f.key
                ? "bg-ink text-white border-ink"
                : "border-paperLine text-inkSoft"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="text-xs border border-paperLine rounded-full px-3 py-1.5"
        >
          <option value="all">พนักงานทุกคน</option>
          {staffNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={fundFilter}
          onChange={(e) => setFundFilter(e.target.value)}
          className="text-xs border border-paperLine rounded-full px-3 py-1.5"
        >
          <option value="all">ทุกฝั่ง</option>
          {Object.entries(funds).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-inkSoft">ไม่มีรายการในหมวดนี้</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-paperLine rounded-lg p-4 receipt-edge hover:border-teal flex items-center gap-3"
            >
              <Link to={`/transaction/${r.id}`} className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-inkSoft mb-1">
                      {r.fundLabel} · {TYPE_LABEL[r.type]} · โดย {r.createdByName}
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
