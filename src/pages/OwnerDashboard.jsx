import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import TypeBadge from "../components/TypeBadge";
import LowFundBalanceBanner from "../components/LowFundBalanceBanner";
import EmptyState from "../components/EmptyState";
import Loading from "../components/ui/Loading";
import { formatBaht, formatDateTime } from "../lib/format";
import { ClipboardCheck } from "lucide-react";
import DashboardInsights from "../components/DashboardInsights";
import TransactionFilterPanel from "../components/TransactionFilterPanel";
import useTransactionFilters from "../components/useTransactionFilters";
import { downloadCsv } from "../components/csvExport";

export default function OwnerDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [funds, setFunds] = useState([]);
  const [topups, setTopups] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubFunds = onSnapshot(collection(db, "funds"), (snap) => {
      setFunds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubTopups = onSnapshot(collection(db, "fundTopups"), (snap) =>
      setTopups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub();
      unsubFunds();
      unsubTopups();
    };
  }, []);

  const { filters, updateFilter, clearFilters, filtered, categories, authors, totals } =
    useTransactionFilters(rows, { initialStatus: "pending" });
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const exportRows = () => downloadCsv("รายการทั้งหมด.csv",
    ["วันที่", "รายละเอียด", "หมวดหมู่", "ประเภท", "จำนวนเงิน", "สถานะ", "ผู้บันทึก", "งบค่าใช้จ่าย"],
    filtered.map((row) => [
      formatDateTime(row.createdAt),
      row.itemDescription,
      row.category,
      row.type === "income" ? "รายรับ" : "รายจ่าย",
      Number(row.amount) || 0,
      row.status,
      row.createdByName,
      row.fundLabel,
    ])
  );

  return (
    <Layout>
      <LowFundBalanceBanner />
      <DashboardInsights
        funds={funds}
        topups={topups}
        transactions={rows}
        pendingCount={pendingCount}
      />
      <h1 className="mb-3 text-lg font-bold">ตรวจสอบรายการทั้งหมด</h1>
      <TransactionFilterPanel
        filters={filters}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
        categories={categories}
        authors={authors}
        totals={totals}
        count={filtered.length}
        onExport={exportRows}
      />

      {loading ? (
        <Loading label="กำลังโหลดรายการที่ต้องตรวจสอบ" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="ไม่มีรายการในตัวกรองนี้"
          description="ลองเปลี่ยนตัวกรอง หรือกลับมาตรวจใหม่ภายหลัง"
        />
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, visibleCount).map((r) => (
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
                    {r.status === "pending" && (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                        <ClipboardCheck size={14} /> เปิดตรวจรายการ
                      </span>
                    )}
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
                {(r.receiptPhotoURLs?.[0] || r.receiptPhotoURL) && (
                  <img
                    src={r.receiptPhotoURLs?.[0] || r.receiptPhotoURL}
                    alt="รูปหลักฐาน"
                    className="mt-3 h-16 w-16 rounded-lg border border-paperLine object-cover"
                  />
                )}
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
          {filtered.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 10)}
              className="w-full rounded-lg border border-paperLine bg-white py-3 text-sm font-medium text-blue-700"
            >
              ดูเพิ่มเติม ({filtered.length - visibleCount} รายการ)
            </button>
          )}
        </div>
      )}
    </Layout>
  );
}
