import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import Layout from "../components/Layout";
import OwnerOverview from "../components/OwnerOverview";
import TransactionFilterPanel from "../components/TransactionFilterPanel";
import useTransactionFilters from "../components/useTransactionFilters";
import StatusBadge from "../components/ui/StatusBadge";
import Button from "../components/ui/Button";
import { downloadCsv } from "../components/csvExport";
import useScopedCashData from "../hooks/useScopedCashData";
import { bangkokDate } from "../lib/businessDate";
import { evidencePhotos } from "../lib/evidence";
import { formatBaht, formatDateTime, STATUS_LABEL, TYPE_LABEL } from "../lib/format";

function DashboardSkeleton() {
  return <div role="status" aria-label="กำลังโหลดข้อมูล" className="animate-pulse space-y-6">
    <div className="h-11 w-48 rounded-lg bg-slate-200" />
    <div className="h-11 rounded-xl bg-slate-200" />
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => <div key={index} className={`h-32 rounded-xl bg-slate-200 ${index === 0 ? "md:col-span-2 lg:col-span-1" : ""}`} />)}
    </div>
    <div className="h-48 rounded-xl bg-slate-200" />
    <div className="space-y-2">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-12 rounded-lg bg-slate-200" />)}</div>
  </div>;
}

export default function OwnerDashboard() {
  const { transactions, loading, funds, topups, error } = useScopedCashData();
  const [month, setMonth] = useState(() => bangkokDate().slice(0, 7));
  const rows = useMemo(() => [...transactions].sort((a, b) =>
    (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)), [transactions]);
  const { filters, updateFilter, clearFilters, filtered, categories, authors, visibleCount, setVisibleCount } =
    useTransactionFilters(rows, { initialStatus: "pending" });
  const displayed = useMemo(() => filters.evidence === "missing"
    ? filtered.filter((row) => evidencePhotos(row).length === 0)
    : filtered, [filtered, filters.evidence]);
  const totals = useMemo(() => displayed.reduce((result, row) => {
    const amount = Math.abs(Number(row.amount) || 0);
    if (row.type === "income") result.income += amount;
    if (row.type === "expense") result.expense += amount;
    return result;
  }, { income: 0, expense: 0 }), [displayed]);
  const attention = [
    { key: "pending", label: "รอตรวจสอบ", count: rows.filter((row) => row.status === "pending").length },
    { key: "needs_evidence", label: "รอหลักฐาน", count: rows.filter((row) => row.status === "needs_evidence").length },
    { key: "missing", label: "ไม่มีหลักฐานแนบ", count: rows.filter((row) => evidencePhotos(row).length === 0).length },
  ];

  function chooseAttention(key) {
    updateFilter("status", key === "missing" ? "all" : key);
    updateFilter("evidence", key === "missing" ? "missing" : "all");
  }

  function updateWorkFilter(key, value) {
    updateFilter(key, value);
    if (key === "status") updateFilter("evidence", "all");
  }

  function resetFilters() {
    clearFilters();
    updateFilter("status", "all");
  }

  function exportRows() {
    downloadCsv("รายการทั้งหมด.csv",
      ["วันที่", "รายละเอียด", "หมวดหมู่", "ประเภท", "จำนวนเงิน", "สถานะ", "จำนวนหลักฐาน", "ผู้บันทึก", "งบค่าใช้จ่าย"],
      displayed.map((row) => [
        formatDateTime(row.createdAt), row.itemDescription, row.category,
        row.type === "income" ? "รายรับ" : "รายจ่าย", Number(row.amount) || 0,
        STATUS_LABEL[row.status] || row.status, evidencePhotos(row).length, row.createdByName, row.fundLabel,
      ]));
  }

  if (loading) return <Layout><DashboardSkeleton /></Layout>;
  if (error) return <Layout><div role="alert" className="rounded-xl border border-paperLine bg-white p-4">
    <p className="text-sm text-danger">โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ</p>
    <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>ลองใหม่</Button>
  </div></Layout>;

  return (
    <Layout>
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">ภาพรวมร้าน / ตรวจสอบรายการทั้งหมด</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-paperLine bg-white px-2 text-sm">
            <span>{month === bangkokDate().slice(0, 7) ? "เดือนนี้" : "เดือนที่เลือก"}</span>
            <input type="month" aria-label="เดือนสำหรับภาพรวม" value={month}
              onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value); }}
              className="min-h-11 max-w-[10rem] bg-transparent font-nums text-sm" />
          </label>
          <Button variant="secondary" onClick={exportRows}>ส่งออก</Button>
        </div>
      </header>

      <section aria-label="รายการที่ต้องดำเนินการ" className="mb-4 rounded-xl border border-paperLine bg-white px-4 shadow-sm">
        {attention.every((item) => item.count === 0)
          ? <p className="flex min-h-11 items-center text-sm text-inkSoft">ไม่มีรายการค้าง ✓</p>
          : <div className="flex flex-wrap items-center gap-x-4">
            {attention.map((item) => <button key={item.key} type="button" onClick={() => chooseAttention(item.key)}
              aria-pressed={item.key === "missing" ? filters.evidence === "missing" : filters.evidence !== "missing" && filters.status === item.key}
              className="min-h-11 text-left text-sm font-semibold text-warning underline-offset-4 aria-pressed:underline">
              {item.label} <span className="font-nums">{item.count}</span>
            </button>)}
          </div>}
      </section>

      <OwnerOverview funds={funds} topups={topups} transactions={rows} month={month} />

      <section className="mt-6" aria-labelledby="work-list-title">
        <TransactionFilterPanel compact filters={filters} updateFilter={updateWorkFilter} clearFilters={resetFilters}
          heading={<h2 id="work-list-title" className="w-full text-base font-semibold sm:w-auto">ตรวจสอบรายการทั้งหมด</h2>}
          categories={categories} authors={authors} funds={funds} totals={totals} count={displayed.length} onExport={exportRows} />
        {displayed.length === 0 ? (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-paperLine bg-white p-4 text-sm">
            <ClipboardCheck size={20} className="text-inkSoft" />
            <p className="flex-1 text-inkSoft">ไม่มีรายการที่ตรงกับตัวกรอง</p>
            <Button variant="secondary" onClick={resetFilters}>ล้างตัวกรอง</Button>
          </div>
        ) : <>
          <div className="hidden overflow-hidden rounded-xl border border-paperLine bg-white shadow-sm lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-paperLine text-xs text-inkSoft">
                <tr><th className="w-[15%] p-2">วันที่</th><th className="w-[25%] p-2">รายการ</th>
                  <th className="w-[19%] p-2">ฝั่ง</th><th className="w-[11%] p-2">ประเภท</th>
                  <th className="w-[15%] p-2 text-right">จำนวนเงิน</th><th className="w-[15%] p-2">สถานะ</th></tr>
              </thead>
              <tbody className="divide-y divide-paperLine">{displayed.slice(0, visibleCount).map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-2 text-xs font-nums">{formatDateTime(row.createdAt)}</td>
                  <td className="p-2"><Link className="block min-h-11 break-words py-2 font-semibold underline-offset-2 hover:underline" to={`/transaction/${row.id}`}>{row.itemDescription}</Link></td>
                  <td className="break-words p-2">{row.fundLabel}</td>
                  <td className="p-2">{TYPE_LABEL[row.type] || row.type}</td>
                  <td className={`break-all p-2 text-right font-nums font-semibold ${row.type === "income" ? "text-income" : "text-expense"}`}>{row.type === "income" ? "+" : "−"}{formatBaht(row.amount)}</td>
                  <td className="p-2"><StatusBadge status={row.status} />
                    {row.status === "approved" && <Link to={`/transaction/${row.id}/print`} target="_blank" className="ml-2 inline-flex min-h-11 items-center text-xs underline">พิมพ์</Link>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="space-y-2 lg:hidden">{displayed.slice(0, visibleCount).map((row) => (
            <div key={row.id} className="rounded-xl border border-paperLine bg-white p-4 shadow-sm">
            <Link to={`/transaction/${row.id}`} className="block min-h-11">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="break-words font-semibold">{row.itemDescription}</p>
                  <p className="text-xs text-inkSoft">{row.fundLabel} · {TYPE_LABEL[row.type] || row.type}</p>
                  <p className="text-xs text-inkSoft font-nums">{formatDateTime(row.createdAt)}</p></div>
                <div className="shrink-0 text-right"><p className={`font-nums font-semibold ${row.type === "income" ? "text-income" : "text-expense"}`}>{row.type === "income" ? "+" : "−"}{formatBaht(row.amount)}</p>
                  <StatusBadge status={row.status} /></div>
              </div>
            </Link>
            {row.status === "approved" && <Link to={`/transaction/${row.id}/print`} target="_blank" className="inline-flex min-h-11 items-center text-xs underline">พิมพ์</Link>}
            </div>
          ))}</div>
          {displayed.length > visibleCount && <Button variant="secondary" className="mt-2 w-full" onClick={() => setVisibleCount((count) => count + 10)}>
            ดูเพิ่มเติม ({displayed.length - visibleCount} รายการ)
          </Button>}
        </>}
      </section>
    </Layout>
  );
}
