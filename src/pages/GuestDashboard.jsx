import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import TypeBadge from "../components/TypeBadge";
import { formatBaht, formatDateTime } from "../lib/format";
import EmptyState from "../components/EmptyState";
import Loading from "../components/ui/Loading";
import { Receipt, SearchX } from "lucide-react";
import DashboardInsights from "../components/DashboardInsights";
import TransactionFilterPanel from "../components/TransactionFilterPanel";
import useTransactionFilters from "../components/useTransactionFilters";
import { downloadCsv } from "../components/csvExport";

export default function GuestDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topups, setTopups] = useState([]);
  const [funds, setFunds] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    // guest อ่านได้เฉพาะรายการที่ "อนุมัติแล้ว" เท่านั้น (บังคับที่ Firestore rules ด้วย)
    const q = query(collection(db, "transactions"), where("status", "==", "approved"));
    const unsub1 = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(collection(db, "funds"), (snap) =>
      setFunds(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub3 = onSnapshot(collection(db, "fundTopups"), (snap) =>
      setTopups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  const { filters, updateFilter, clearFilters, filtered, categories, authors, totals } =
    useTransactionFilters(rows);
  const filteredRows = filtered.slice().sort(
    (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
  );
  const exportRows = () => downloadCsv("รายการที่อนุมัติ.csv",
    ["วันที่", "รายละเอียด", "หมวดหมู่", "ประเภท", "จำนวนเงิน", "สถานะ", "ผู้บันทึก", "งบค่าใช้จ่าย"],
    filteredRows.map((row) => [
      formatDateTime(row.createdAt),
      row.itemDescription,
      row.category,
      row.type === "income" ? "รายรับ" : "รายจ่าย",
      Number(row.amount) || 0,
      "อนุมัติแล้ว",
      row.createdByName,
      row.fundLabel,
    ])
  );

  return (
    <Layout>
      <DashboardInsights funds={funds} topups={topups} transactions={rows} />

      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-slab text-lg">รายการที่อนุมัติแล้ว</h1>
        <Link to="/reports" className="rounded-lg border border-paperLine px-3 py-2 text-sm text-blue-700">
          ดูรายงาน
        </Link>
      </div>

      <TransactionFilterPanel
        filters={filters}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
        categories={categories}
        authors={authors}
        funds={funds}
        totals={totals}
        count={filteredRows.length}
        showStatus
        statusOptions={[{ value: "approved", label: "อนุมัติแล้ว" }]}
        onExport={exportRows}
      />

      {loading ? (
        <Loading label="กำลังโหลดรายการที่อนุมัติ" />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={rows.length ? SearchX : Receipt}
          title={rows.length ? "ไม่พบรายการที่ตรงกัน" : "ยังไม่มีรายการที่อนุมัติแล้ว"}
          description={rows.length ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "รายการที่เจ้าของร้านอนุมัติจะแสดงที่นี่"}
        />
      ) : (
        <div className="space-y-3">
          {filteredRows.slice(0, visibleCount).map((r) => (
            <div
              key={r.id}
              className="bg-white border border-paperLine rounded-xl p-4 shadow-sm hover:border-blue-300 flex items-center gap-3"
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
                        r.type === "income" ? "text-green-800" : "text-red-700"
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
              <Link
                to={`/transaction/${r.id}/print`}
                target="_blank"
                className="shrink-0 text-xs border border-paperLine rounded px-3 py-2 hover:border-teal hover:text-teal"
              >
                พิมพ์
              </Link>
            </div>
          ))}
          {filteredRows.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 10)}
              className="w-full rounded-lg border border-paperLine bg-white py-3 text-sm font-medium text-blue-700"
            >
              ดูเพิ่มเติม ({filteredRows.length - visibleCount} รายการ)
            </button>
          )}
        </div>
      )}
    </Layout>
  );
}
