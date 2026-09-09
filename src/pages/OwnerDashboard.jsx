import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import TypeBadge from "../components/TypeBadge";
import LowFundBalanceBanner from "../components/LowFundBalanceBanner";
import Combobox from "../components/Combobox";
import MetricCard from "../components/MetricCard";
import { formatBaht, formatDateTime } from "../lib/format";
import { ArrowUpRight, ArrowDownRight, ClipboardList } from "lucide-react";

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="รายรับรวม"
          value={formatBaht(totalIn)}
          icon={ArrowUpRight}
          tone="income"
          sublabel="ไม่รวมตีกลับ/ยกเลิก"
        />
        <MetricCard label="รายจ่ายรวม" value={formatBaht(totalOut)} icon={ArrowDownRight} tone="expense" />
        <MetricCard
          label="รอตรวจสอบ"
          value={`${pendingCount} รายการ`}
          icon={ClipboardList}
          tone="primary"
        />
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
        <Combobox
          value={staffFilter}
          onChange={setStaffFilter}
          options={[{ value: "all", label: "พนักงานทุกคน" }, ...staffNames.map((n) => ({ value: n, label: n }))]}
          className="w-48"
        />
        <Combobox
          value={fundFilter}
          onChange={setFundFilter}
          options={[
            { value: "all", label: "ทุกฝั่ง" },
            ...Object.entries(funds).map(([id, label]) => ({ value: id, label })),
          ]}
          className="w-48"
        />
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
                  <div className="min-w-0">
                    <div className="mb-1">
                      <TypeBadge type={r.type} />
                    </div>
                    <div className="text-xs text-inkSoft mb-1">
                      {r.fundLabel} · โดย {r.createdByName}
                    </div>
                    <div className="font-medium truncate">{r.itemDescription}</div>
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
