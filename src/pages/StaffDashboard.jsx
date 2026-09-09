import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import TypeBadge from "../components/TypeBadge";
import EmptyState from "../components/EmptyState";
import LowFundBalanceBanner from "../components/LowFundBalanceBanner";
import MetricCard from "../components/MetricCard";
import Combobox from "../components/Combobox";
import { formatBaht, formatDateTime, PAYMENT_LABEL } from "../lib/format";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Search,
  Receipt,
  SearchX,
  PlusCircle,
  X,
} from "lucide-react";

const DATE_PRESETS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "today", label: "วันนี้" },
  { key: "7d", label: "7 วันล่าสุด" },
  { key: "month", label: "เดือนนี้" },
];

function withinDatePreset(date, preset) {
  if (preset === "all" || !date) return true;
  const now = new Date();
  const d = date.toDate ? date.toDate() : new Date(date);
  if (preset === "today") {
    return d.toDateString() === now.toDateString();
  }
  if (preset === "7d") {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  }
  if (preset === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return true;
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort();
    return [{ value: "all", label: "ทุกหมวดหมู่" }, ...cats.map((c) => ({ value: c, label: c }))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (!withinDatePreset(r.createdAt, datePreset)) return false;
      if (q) {
        const haystack = `${r.itemDescription || ""} ${r.note || ""} ${r.category || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, datePreset, categoryFilter]);

  const hasActiveFilters = search.trim() !== "" || datePreset !== "all" || categoryFilter !== "all";

  function clearFilters() {
    setSearch("");
    setDatePreset("all");
    setCategoryFilter("all");
  }

  return (
    <Layout>
      <LowFundBalanceBanner />

      {/* สรุปยอด */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="รายรับรวม" value={formatBaht(totalIn)} icon={ArrowUpRight} tone="income" />
        <MetricCard label="รายจ่ายรวม" value={formatBaht(totalOut)} icon={ArrowDownRight} tone="expense" />
        <MetricCard label="คงเหลือสุทธิ" value={formatBaht(totalIn - totalOut)} icon={Wallet} tone="primary" />
      </div>

      {/* Header: ชื่อหน้า + ค้นหา + ตัวกรอง + ปุ่มบันทึกใหม่ */}
      <div className="bg-white border border-paperLine rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <h1 className="font-slab text-lg shrink-0">รายการของฉัน</h1>

          <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center min-w-0">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkSoft" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหารายละเอียด, หมวดหมู่, หมายเหตุ..."
                className="w-full border border-paperLine rounded-lg pl-9 pr-3 py-2 text-sm focus:border-teal"
              />
            </div>
            <Combobox
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              className="w-full sm:w-44 shrink-0"
            />
          </div>

          <Link
            to="/new"
            className="flex items-center justify-center gap-1.5 bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium shrink-0 transition-colors"
          >
            <PlusCircle size={17} />
            บันทึกใหม่
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-paperLine">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setDatePreset(p.key)}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                datePreset === p.key
                  ? "bg-ink text-white border-ink"
                  : "border-paperLine text-inkSoft hover:border-teal hover:text-teal"
              }`}
            >
              {p.label}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-rust ml-1"
            >
              <X size={13} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="ยังไม่มีรายการ"
          description='กดปุ่ม "บันทึกใหม่" ด้านบนเพื่อเริ่มบันทึกรายรับ-รายจ่ายรายการแรกของคุณ'
          action={
            <Link
              to="/new"
              className="inline-flex items-center gap-1.5 bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <PlusCircle size={16} />
              บันทึกรายการแรก
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="ไม่พบรายการที่ตรงกับตัวกรอง"
          description="ลองเปลี่ยนคำค้นหา หมวดหมู่ หรือช่วงวันที่ดู"
          action={
            <button
              onClick={clearFilters}
              className="text-sm border border-paperLine rounded-lg px-4 py-2 hover:border-teal hover:text-teal"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-paperLine rounded-xl shadow-sm p-4 hover:border-teal transition-colors flex items-center gap-3"
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  r.type === "income" ? "bg-teal-light text-teal" : "bg-rust-light text-rust"
                }`}
              >
                {r.type === "income" ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              </span>

              <Link to={`/transaction/${r.id}`} className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-1">
                      <TypeBadge type={r.type} />
                      {r.category && (
                        <span className="text-[11px] text-inkSoft bg-paper rounded-full px-2 py-0.5">
                          {r.category}
                        </span>
                      )}
                    </div>
                    <div className="font-medium truncate">{r.itemDescription}</div>
                    <div className="text-xs text-inkSoft mt-1 truncate">
                      {r.fundLabel} · {PAYMENT_LABEL[r.paymentMethod]} · {formatDateTime(r.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-nums text-lg font-semibold ${
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
                  className="shrink-0 text-xs border border-paperLine rounded-lg px-3 py-2 hover:border-teal hover:text-teal"
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
