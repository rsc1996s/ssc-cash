import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import StatusBadge from "../components/ui/StatusBadge";
import TypeBadge from "../components/TypeBadge";
import EmptyState from "../components/ui/EmptyState";
import LowFundBalanceBanner from "../components/LowFundBalanceBanner";
import SectionTitle from "../components/ui/SectionTitle";
import Card from "../components/ui/Card";
import { formatBaht, formatDateTime, PAYMENT_LABEL, STATUS_LABEL } from "../lib/format";
import { evidencePhotos } from "../lib/evidence";
import {
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  SearchX,
} from "lucide-react";
import TransactionFilterPanel from "../components/TransactionFilterPanel";
import useTransactionFilters from "../components/useTransactionFilters";
import { downloadCsv } from "../components/csvExport";
import useScopedCashData from "../hooks/useScopedCashData";
import Loading from "../components/ui/Loading";
import FundDashboard from "../components/FundDashboard";

export default function StaffDashboard() {
  const { user } = useAuth();
  const { funds, topups, transactions, loading, error, empty } = useScopedCashData();
  const rows = useMemo(() => transactions.filter((row) => row.createdBy === user?.uid)
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)), [transactions, user?.uid]);
  const indexUrl = error?.message?.match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/)?.[0]?.replace(/[).,]+$/, "");
  const loadError = error ? {
    message: "โหลดรายการไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์ Firestore",
    indexUrl,
    needsIndex: error.code === "failed-precondition",
  } : null;
  const [visibleCount, setVisibleCount] = useState(10);

  const { filters, updateFilter, clearFilters, filtered, categories, authors, totals } =
    useTransactionFilters(rows);
  const exportRows = () => downloadCsv("รายการของฉัน.csv",
    ["วันที่", "รายละเอียด", "หมวดหมู่", "ประเภท", "จำนวนเงิน", "สถานะ", "จำนวนหลักฐาน", "ผู้บันทึก", "งบค่าใช้จ่าย", "ช่องทาง"],
    filtered.map((row) => [
      formatDateTime(row.createdAt),
      row.itemDescription,
      row.category,
      row.type === "income" ? "รายรับ" : "รายจ่าย",
      Number(row.amount) || 0,
      STATUS_LABEL[row.status] || row.status,
      evidencePhotos(row).length,
      row.createdByName,
      row.fundLabel,
      PAYMENT_LABEL[row.paymentMethod],
    ])
  );

  if (loading) return <Layout><Loading label="กำลังโหลดงบที่คุณดูแล" /></Layout>;
  if (loadError) return <Layout><div role="alert" className="rounded-lg border border-danger/30 p-4 text-sm text-danger">
    {loadError.needsIndex ? "ยังไม่ได้สร้าง Firestore index ที่จำเป็น จึงโหลดรายการไม่ได้" : loadError.message}
    {loadError.indexUrl && <a href={loadError.indexUrl} target="_blank" rel="noreferrer" className="ml-2 underline">สร้าง index</a>}
  </div></Layout>;

  return (
    <Layout>
      <LowFundBalanceBanner />
      {empty && <p className="mb-4 rounded-lg bg-warning-light p-3 text-sm text-warning">ยังไม่ได้รับมอบหมายงบ ติดต่อแอดมิน</p>}

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="min-w-0">
          <FundDashboard funds={funds} topups={topups} transactions={transactions} />
        </div>
        <div className="min-w-0">
      <SectionTitle title="รายการของฉัน" className="mb-2" />
      {rows.some((row) => row.status === "needs_evidence") && (
        <div className="mb-3 rounded-lg border border-warning/40 bg-warning-light p-3 text-sm text-warning">
          <p className="font-semibold">ต้องแนบหลักฐาน {rows.filter((row) => row.status === "needs_evidence").length} รายการ</p>
          <ul className="mt-1 space-y-1">
            {rows.filter((row) => row.status === "needs_evidence").map((row) => (
              <li key={row.id}><Link className="underline" to={`/transaction/${row.id}`}>{row.itemDescription}</Link></li>
            ))}
          </ul>
        </div>
      )}
      <TransactionFilterPanel
        filters={filters}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
        categories={categories}
        authors={authors}
        totals={totals}
        count={filtered.length}
        showAuthor={false}
        showTotals={false}
        onExport={exportRows}
      />

      {loadError ? (
        <div role="alert" className="bg-danger/5 border border-danger/30 rounded-lg p-4 text-sm text-danger">
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
          compact
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
                  className="shrink-0 text-xs border border-paperLine rounded-lg px-3 py-2 hover:border-primary hover:text-primary"
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
        </div>
      </div>
    </Layout>
  );
}
