import { useMemo } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StatusBadge from "../components/ui/StatusBadge";
import TypeBadge from "../components/TypeBadge";
import { formatBaht, formatDateTime } from "../lib/format";
import EmptyState from "../components/ui/EmptyState";
import Loading from "../components/ui/Loading";
import SectionTitle from "../components/ui/SectionTitle";
import Card from "../components/ui/Card";
import { Receipt, SearchX } from "lucide-react";
import DashboardInsights from "../components/DashboardInsights";
import TransactionFilterPanel from "../components/TransactionFilterPanel";
import useTransactionFilters from "../components/useTransactionFilters";
import { downloadCsv } from "../components/csvExport";
import { evidencePhotos } from "../lib/evidence";
import useScopedCashData from "../hooks/useScopedCashData";
import FundDashboard from "../components/FundDashboard";
import Button from "../components/ui/Button";

export default function GuestDashboard() {
  const { transactions, loading, funds, topups, error, empty } = useScopedCashData();
  const rows = useMemo(() => transactions.filter((row) => row.status === "approved"), [transactions]);
  const { filters, updateFilter, clearFilters, filtered, categories, authors, totals, visibleCount, setVisibleCount } =
    useTransactionFilters(rows);
  const filteredRows = filtered.slice().sort(
    (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
  );
  const exportRows = () => downloadCsv("รายการที่อนุมัติ.csv",
    ["วันที่", "รายละเอียด", "หมวดหมู่", "ประเภท", "จำนวนเงิน", "สถานะ", "จำนวนหลักฐาน", "ผู้บันทึก", "งบค่าใช้จ่าย"],
    filteredRows.map((row) => [
      formatDateTime(row.createdAt),
      row.itemDescription,
      row.category,
      row.type === "income" ? "รายรับ" : "รายจ่าย",
      Number(row.amount) || 0,
      "อนุมัติแล้ว",
      evidencePhotos(row).length,
      row.createdByName,
      row.fundLabel,
    ])
  );

  if (loading) return <Layout><Loading label="กำลังโหลดงบที่คุณดูแล" /></Layout>;
  if (error) return <Layout><div role="alert" className="rounded-xl border border-paperLine bg-white p-4">
    <p className="text-sm text-danger">โหลดข้อมูลงบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ</p>
    <Button variant="secondary" className="mt-3" onClick={() => window.location.reload()}>ลองใหม่</Button>
  </div></Layout>;

  return (
    <Layout>
      {empty && <p className="mb-4 rounded-lg bg-warning-light p-3 text-sm text-warning">ยังไม่ได้รับมอบหมายงบ ติดต่อแอดมิน</p>}
      <FundDashboard funds={funds} topups={topups} transactions={rows} />
      <details className="mb-3 rounded-xl border border-paperLine bg-white p-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-700">ดูภาพรวมงบทั้งหมดเพิ่มเติม</summary>
        <DashboardInsights funds={funds} topups={topups} transactions={rows} />
      </details>

      <SectionTitle
        title="รายการที่อนุมัติแล้ว"
        action={<Link to="/reports" className="inline-flex min-h-11 items-center rounded-lg border border-paperLine px-3 text-sm font-medium text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">ดูรายงาน</Link>}
      />

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
            <Card
              key={r.id}
              className="flex items-center gap-3 p-4"
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
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-paperLine px-3 text-xs hover:border-primary hover:text-primary"
              >
                พิมพ์
              </Link>
            </Card>
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
