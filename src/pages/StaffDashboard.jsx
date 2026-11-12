import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import StatusBadge from "../components/ui/StatusBadge";
import TypeBadge from "../components/TypeBadge";
import EmptyState from "../components/ui/EmptyState";
import LowFundBalanceBanner from "../components/LowFundBalanceBanner";
import MetricCard from "../components/MetricCard";
import SectionTitle from "../components/ui/SectionTitle";
import Card from "../components/ui/Card";
import { formatBaht, formatDateTime, PAYMENT_LABEL } from "../lib/format";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  SearchX,
} from "lucide-react";
import TransactionFilterPanel from "../components/TransactionFilterPanel";
import useTransactionFilters from "../components/useTransactionFilters";
import { downloadCsv } from "../components/csvExport";

export default function StaffDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "transactions"),
      where("createdBy", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadError(null);
        setLoading(false);
      },
      (error) => {
        console.error("โหลดรายการธุรกรรมไม่สำเร็จ:", error);
        const indexUrl = error.message.match(
          /https:\/\/console\.firebase\.google\.com\/[^\s]+/
        )?.[0]?.replace(/[).,]+$/, "");
        setLoadError({
          message: "โหลดรายการไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์ Firestore",
          indexUrl,
          needsIndex: error.code === "failed-precondition",
        });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const { filters, updateFilter, clearFilters, filtered, categories, authors, totals } =
    useTransactionFilters(rows);
  const exportRows = () => downloadCsv("รายการของฉัน.csv",
    ["วันที่", "รายละเอียด", "หมวดหมู่", "ประเภท", "จำนวนเงิน", "สถานะ", "ผู้บันทึก", "งบค่าใช้จ่าย", "ช่องทาง"],
    filtered.map((row) => [
      formatDateTime(row.createdAt),
      row.itemDescription,
      row.category,
      row.type === "income" ? "รายรับ" : "รายจ่าย",
      Number(row.amount) || 0,
      row.status,
      row.createdByName,
      row.fundLabel,
      PAYMENT_LABEL[row.paymentMethod],
    ])
  );

  return (
    <Layout>
      <LowFundBalanceBanner />

      <div className="grid grid-cols-2 gap-3 mb-5 sm:gap-4">
        <div className="col-span-2">
          <MetricCard label="ยอดคงเหลือสุทธิ" value={`${formatBaht(totals.income - totals.expense)} บาท`} icon={Wallet} tone="primary" />
        </div>
        <MetricCard label="รายรับรวม" value={formatBaht(totals.income)} icon={ArrowUpRight} tone="income" />
        <MetricCard label="รายจ่ายรวม" value={formatBaht(totals.expense)} icon={ArrowDownRight} tone="expense" />
      </div>

      <SectionTitle title="รายการของฉัน" />
      <TransactionFilterPanel
        filters={filters}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
        categories={categories}
        authors={authors}
        totals={totals}
        count={filtered.length}
        showAuthor={false}
        onExport={exportRows}
      />

      {loadError ? (
        <div role="alert" className="bg-rust/5 border border-rust/30 rounded-lg p-4 text-sm text-rust">
          <p>{loadError.needsIndex
            ? "ยังไม่ได้สร้าง Firestore index ที่จำเป็น จึงโหลดรายการไม่ได้"
            : loadError.message}</p>
          {loadError.indexUrl && (
            <a
              href={loadError.indexUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 underline font-medium"
            >
              เปิด Firebase Console เพื่อสร้าง index
            </a>
          )}
        </div>
      ) : loading ? (
        <div className="space-y-3" role="status" aria-label="กำลังโหลดรายการ">
          <div className="h-20 animate-pulse rounded-xl bg-blue-100" />
          <div className="h-20 animate-pulse rounded-xl bg-blue-100" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="ยังไม่มีรายการ"
          description="แตะปุ่ม + ด้านล่างเพื่อบันทึกรายการแรก"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="ไม่พบรายการที่ตรงกับตัวกรอง"
          description="ลองเปลี่ยนคำค้นหา หมวดหมู่ หรือช่วงวันที่ดู"
          action={
            <button
              onClick={clearFilters}
                className="min-h-11 rounded-lg border border-paperLine px-4 text-sm font-medium text-blue-800 hover:bg-blue-50"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, visibleCount).map((r) => (
            <Card
              key={r.id}
              className="flex items-center gap-3 p-4"
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  r.type === "income" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
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

              {r.status === "approved" && (
                <Link
                  to={`/transaction/${r.id}/print`}
                  target="_blank"
                  className="shrink-0 text-xs border border-paperLine rounded-lg px-3 py-2 hover:border-teal hover:text-teal"
                >
                  พิมพ์
                </Link>
              )}
            </Card>
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
