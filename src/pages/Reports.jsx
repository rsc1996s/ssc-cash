import { useEffect, useMemo, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import { formatBaht, formatDateTime, TYPE_LABEL, STATUS_LABEL } from "../lib/format";
import { buildFundLedger, statementForRange } from "../lib/ledger";
import OverviewCharts from "../components/OverviewCharts";
import { useAuth } from "../context/AuthContext";
import { downloadCsv } from "../components/csvExport";
import useTransactionFilters from "../components/useTransactionFilters";
import TransactionFilterPanel from "../components/TransactionFilterPanel";
import Loading from "../components/ui/Loading";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

function toInputDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CATEGORY_COLORS = ["#2563EB", "#0EA5E9", "#16A34A", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"];

function reportDate(row) {
  const date = row.reviewedAt || row.createdAt;
  return date ? (date.toDate ? date.toDate() : new Date(date)) : null;
}

function reportRange(filters) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (filters.datePreset === "today") return [new Date(now.getFullYear(), now.getMonth(), now.getDate()), end];
  if (filters.datePreset === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return [start, end];
  }
  if (filters.datePreset === "month") return [new Date(now.getFullYear(), now.getMonth(), 1), end];
  if (filters.datePreset === "custom") {
    return [
      filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`) : new Date(0),
      filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`) : end,
    ];
  }
  return [new Date(0), end];
}

export default function Reports() {
  const { isOwner } = useAuth();
  const [funds, setFunds] = useState([]);
  const [topups, setTopups] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [fundId, setFundId] = useState("");
  const [initialFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toInputDate(d);
  });
  const [initialToDate] = useState(() => toInputDate(new Date()));
  const [reportTab, setReportTab] = useState("statement");
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    const handleLoadError = (error) => {
      console.error("โหลดข้อมูลรายงานไม่สำเร็จ:", error);
      setLoadError("โหลดข้อมูลรายงานไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์ Firestore");
      setLoading(false);
    };
    const unsub1 = onSnapshot(collection(db, "funds"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFunds(list);
      setFundId((cur) => cur || list[0]?.id || "");
    }, handleLoadError);
    const unsub2 = onSnapshot(
      collection(db, "fundTopups"),
      (snap) => setTopups(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      handleLoadError
    );
    const transactionQuery = isOwner
      ? query(collection(db, "transactions"), orderBy("createdAt", "desc"))
      : query(collection(db, "transactions"), where("status", "==", "approved"));
    const unsub3 = onSnapshot(transactionQuery, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, handleLoadError);
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [isOwner]);

  const fund = funds.find((f) => f.id === fundId);
  const reportTransactions = transactions.filter((transaction) => transaction.fundId === fundId);
  const { filters, updateFilter, clearFilters, filtered, categories, authors, totals } =
    useTransactionFilters(reportTransactions, {
      getDate: reportDate,
      initialDatePreset: "month",
      initialFromDate,
      initialToDate,
    });

  const statement = useMemo(() => {
    if (!fund) return null;
    const ledger = buildFundLedger(fund, topups, transactions);
    const [start, end] = reportRange(filters);
    return statementForRange(ledger, start, end, fund.openingBalance || 0);
  }, [fund, topups, transactions, filters.datePreset, filters.fromDate, filters.toDate]);

  const categoryTotals = useMemo(() => {
    const totalsByCategory = new Map();
    filtered.filter((row) => row.type === "expense").forEach((row) => {
      const category = row.category || "ไม่ระบุหมวดหมู่";
      totalsByCategory.set(category, (totalsByCategory.get(category) || 0) + (Number(row.amount) || 0));
    });
    const categoriesByAmount = Array.from(totalsByCategory, ([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const total = categoriesByAmount.reduce((sum, item) => sum + item.amount, 0);
    return categoriesByAmount.map((item) => ({
      ...item,
      percent: total ? (item.amount / total) * 100 : 0,
    }));
  }, [filtered]);

  const exportRows = () => downloadCsv("รายงานรายการ.csv",
    ["วันที่", "รายละเอียด", "หมวดหมู่", "ประเภท", "จำนวนเงิน", "สถานะ", "ผู้บันทึก", "งบค่าใช้จ่าย"],
    filtered.map((row) => [
      formatDateTime(row.reviewedAt || row.createdAt),
      row.itemDescription,
      row.category,
      row.type === "income" ? "รายรับ" : "รายจ่าย",
      Number(row.amount) || 0,
      row.status || "approved",
      row.createdByName,
      row.fundLabel,
    ])
  );

  return (
    <Layout>
      <div className="no-print mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">รายงาน Statement & ภาพรวม</h1>
        {statement && (
          <button
            onClick={() => window.print()}
            className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            พิมพ์รายงาน
          </button>
        )}
      </div>

      <div role="tablist" aria-label="ส่วนของรายงาน" className="no-print mb-4 flex gap-2 overflow-x-auto">
        {[
          ["statement", "Statement"],
          ["transactions", `รายการ (${filtered.length})`],
          ["categories", "หมวดหมู่"],
        ].map(([value, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={reportTab === value}
            key={value}
            onClick={() => setReportTab(value)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${
              reportTab === value ? "border-blue-600 bg-blue-600 text-white" : "border-paperLine bg-white text-inkSoft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="no-print mb-4 rounded-xl border border-paperLine bg-white p-4 shadow-sm">
        <label className="text-xs text-inkSoft block mb-1">เลือกฝั่งเงินหมุนเวียน</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {funds.map((f) => (
            <button
              key={f.id}
              onClick={() => setFundId(f.id)}
              className={`text-xs rounded-full px-3 py-1.5 border ${
                fundId === f.id ? "bg-blue-600 text-white border-blue-600" : "border-paperLine text-inkSoft"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

      </div>

      <div className="no-print">
        <TransactionFilterPanel
          filters={filters}
          updateFilter={updateFilter}
          clearFilters={clearFilters}
          categories={categories}
          authors={authors}
          totals={totals}
          count={filtered.length}
          showStatus={isOwner}
          statusOptions={isOwner ? undefined : [{ value: "approved", label: "อนุมัติแล้ว" }]}
          onExport={exportRows}
        />
      </div>

      {reportTab === "statement" && (loadError ? (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {loadError}
        </div>
      ) : loading ? (
        <Loading label="กำลังโหลดรายงาน" />
      ) : !fund ? (
        <p className="text-sm text-inkSoft">
          ยังไม่มีฝั่งเงินหมุนเวียนในระบบ — ไปที่เมนู "งบค่าใช้จ่าย" เพื่อสร้างฝั่งก่อน
        </p>
      ) : (
        <div className="print-sheet bg-white border border-paperLine rounded-lg p-6">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold">รายงานเงินหมุนเวียน: {fund.label}</h2>
            <p className="text-sm text-inkSoft">
              ช่วงวันที่ {toInputDate(reportRange(filters)[0])} ถึง {toInputDate(reportRange(filters)[1])}
            </p>
          </div>

          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full table-fixed text-sm mb-4">
            <thead>
              <tr className="border-b border-paperLine text-inkSoft text-xs">
                <th className="text-left py-2">วันที่</th>
                <th className="text-left py-2">รายการ</th>
                <th className="text-left py-2">ประเภท</th>
                <th className="text-right py-2">จำนวนเงิน</th>
                <th className="text-right py-2">คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {statement.entries.map((e, i) => (
                <tr key={i} className="border-b border-paperLine/60">
                  <td className="py-2">{formatDateTime(e.date)}</td>
                  <td className="py-2">{e.detail}</td>
                  <td className="py-2">
                    {e.kind === "topup" ? "เงินเข้างบค่าใช้จ่าย" : TYPE_LABEL[e.kind] || e.kind}
                  </td>
                  <td
                    className={`py-2 text-right font-nums ${
                      e.amount < 0 ? "text-red-700" : "text-green-800"
                    }`}
                  >
                    {e.amount < 0 ? "-" : "+"}
                    {formatBaht(Math.abs(e.amount))}
                  </td>
                  <td className="py-2 text-right font-nums">{formatBaht(e.balance)}</td>
                </tr>
              ))}
              {statement.entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-inkSoft">
                    ไม่มีรายการในช่วงที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="mb-4 space-y-2 sm:hidden">
            {statement.entries.map((entry, index) => (
              <div key={`${entry.date}-${index}`} className="rounded-lg border border-paperLine p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{entry.detail}</p>
                    <p className="mt-1 text-xs text-inkSoft">{formatDateTime(entry.date)} · {entry.kind === "topup" ? "เงินเข้างบค่าใช้จ่าย" : TYPE_LABEL[entry.kind] || entry.kind}</p>
                  </div>
                  <p className={`shrink-0 text-right font-nums ${entry.amount < 0 ? "text-red-700" : "text-green-800"}`}>
                    {entry.amount < 0 ? "-" : "+"}{formatBaht(Math.abs(entry.amount))}
                  </p>
                </div>
                <p className="mt-2 text-right text-xs text-inkSoft">คงเหลือ {formatBaht(entry.balance)} บาท</p>
              </div>
            ))}
            {statement.entries.length === 0 && <p className="py-4 text-center text-sm text-inkSoft">ไม่มีรายการในช่วงที่เลือก</p>}
          </div>

          <dl className="grid grid-cols-2 gap-y-1 text-sm max-w-xs ml-auto font-nums">
            <dt className="text-inkSoft">ยอดยกมา</dt>
            <dd className="text-right">{formatBaht(statement.openingBalance)}</dd>
            <dt className="text-inkSoft">เงินเข้ารวม (ช่วงนี้)</dt>
            <dd className="text-right text-teal">+{formatBaht(statement.totalIn)}</dd>
            <dt className="text-inkSoft">เงินออกรวม (ช่วงนี้)</dt>
            <dd className="text-right text-rust">-{formatBaht(statement.totalOut)}</dd>
            <dt className="font-medium border-t border-ink pt-1">ยอดคงเหลือ</dt>
            <dd className="text-right font-medium border-t border-ink pt-1">
              {formatBaht(statement.closingBalance)}
            </dd>
          </dl>
        </div>
      ))}

      {statement && reportTab === "statement" && (
        <div className="no-print">
          <OverviewCharts
            statement={statement}
            fromDate={reportRange(filters)[0]}
            categoryTotals={categoryTotals}
          />
        </div>
      )}

      {filtered.length > 0 && reportTab === "transactions" && (
        <section className="no-print mt-5 overflow-hidden rounded-xl border border-paperLine bg-white shadow-sm">
          <div className="border-b border-paperLine p-4">
            <h2 className="text-lg font-bold">รายการตามตัวกรอง</h2>
            <p className="text-sm text-inkSoft">จำนวนเงินและยอดรวมสอดคล้องกับผลการค้นหาด้านบน</p>
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paperLine bg-blue-50 text-left text-inkSoft">
                  <th className="px-4 py-2">วันที่</th>
                  <th className="px-4 py-2">รายละเอียด</th>
                  <th className="px-4 py-2">หมวดหมู่</th>
                  <th className="px-4 py-2">สถานะ</th>
                  <th className="px-4 py-2 text-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, visibleCount).map((row) => (
                  <tr key={row.id} className="border-b border-paperLine/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(row.reviewedAt || row.createdAt)}</td>
                    <td className="max-w-[240px] truncate px-4 py-3">{row.itemDescription || "—"}</td>
                    <td className="px-4 py-3">{row.category || "ไม่ระบุหมวดหมู่"}</td>
                    <td className="px-4 py-3">{STATUS_LABEL[row.status] || row.status || STATUS_LABEL.approved}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-nums font-semibold ${row.type === "income" ? "text-green-800" : "text-red-700"}`}>
                      {row.type === "income" ? "+" : "-"}{formatBaht(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 sm:hidden">
            {filtered.slice(0, visibleCount).map((row) => (
              <article key={row.id} className="rounded-lg border border-paperLine p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{row.itemDescription || "—"}</p>
                    <p className="mt-1 text-xs text-inkSoft">{formatDateTime(row.reviewedAt || row.createdAt)} · {row.category || "ไม่ระบุหมวดหมู่"}</p>
                    <p className="mt-1 text-xs text-inkSoft">{STATUS_LABEL[row.status] || row.status || STATUS_LABEL.approved}</p>
                  </div>
                  <p className={`shrink-0 text-right font-nums font-semibold ${row.type === "income" ? "text-green-800" : "text-red-700"}`}>
                    {row.type === "income" ? "+" : "-"}{formatBaht(row.amount)}
                  </p>
                </div>
              </article>
            ))}
          </div>
          {filtered.length > visibleCount && (
            <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="m-3 w-[calc(100%-1.5rem)] rounded-lg border border-paperLine py-3 text-sm text-blue-700">
              ดูเพิ่มเติม ({filtered.length - visibleCount})
            </button>
          )}
        </section>
      )}

      {reportTab === "categories" && <section className="no-print mt-5 rounded-xl border border-paperLine bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">สรุปค่าใช้จ่ายตามหมวดหมู่</h2>
        <p className="mb-4 text-sm text-inkSoft">อ้างอิงรายการที่ตรงกับตัวกรองข้างต้น</p>
        {categoryTotals.length === 0 ? (
          <p className="rounded-lg bg-blue-50 p-4 text-sm text-inkSoft">ไม่มีค่าใช้จ่ายในผลการกรองนี้</p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold">สัดส่วนค่าใช้จ่าย</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryTotals}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {categoryTotals.map((item, index) => (
                        <Cell key={item.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${formatBaht(value)} บาท`, "ค่าใช้จ่าย"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-paperLine text-left text-inkSoft">
                    <th className="py-2">หมวดหมู่</th>
                    <th className="py-2 text-right">สัดส่วน</th>
                    <th className="py-2 text-right">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTotals.map((item) => (
                    <tr key={item.category} className="border-b border-paperLine/60">
                      <td className="py-2">{item.category}</td>
                      <td className="py-2 text-right">{item.percent.toFixed(1)}%</td>
                      <td className="py-2 text-right font-nums">{formatBaht(item.amount)} บาท</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>}
    </Layout>
  );
}
