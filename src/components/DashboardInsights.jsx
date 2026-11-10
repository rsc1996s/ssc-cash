import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { currentFundBalance } from "../lib/ledger";
import { formatBaht } from "../lib/format";
import Card from "./ui/Card";
import MetricCard from "./MetricCard";

function monthStart(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function dateValue(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

function monthLabel(date) {
  return date.toLocaleDateString("th-TH", { month: "short" });
}

export default function DashboardInsights({ funds, topups, transactions, pendingCount }) {
  const approved = useMemo(
    () => transactions.filter((transaction) => transaction.status === "approved"),
    [transactions]
  );
  const monthly = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => monthStart(now, index - 5));
    const totals = new Map(months.map((month) => [monthKey(month), { income: 0, expense: 0 }]));
    approved.forEach((transaction) => {
      const date = dateValue(transaction.reviewedAt || transaction.createdAt);
      if (!date) return;
      const month = totals.get(monthKey(date));
      if (!month) return;
      month[transaction.type] += Number(transaction.amount) || 0;
    });
    return months.map((month) => {
      const total = totals.get(monthKey(month));
      return { label: monthLabel(month), income: total.income, expense: total.expense, net: total.income - total.expense };
    });
  }, [approved]);

  const thisMonth = monthly[monthly.length - 1] || { income: 0, expense: 0 };
  const previousMonth = monthly[monthly.length - 2] || { income: 0, expense: 0 };
  const recent = [...approved]
    .sort((a, b) => (dateValue(b.reviewedAt || b.createdAt)?.getTime() || 0) - (dateValue(a.reviewedAt || a.createdAt)?.getTime() || 0))
    .slice(0, 5);

  return (
    <section className="mb-6 space-y-4">
      <div>
        <h2 className="mb-3 text-lg font-bold">ภาพรวมร้าน</h2>
        {funds.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {funds.map((fund) => (
              <MetricCard
                key={fund.id}
                label={`คงเหลือ · ${fund.label}`}
                value={`${formatBaht(currentFundBalance(fund, topups, approved))} บาท`}
                tone="primary"
              />
            ))}
          </div>
        ) : (
          <Card className="p-4 text-sm text-inkSoft">ยังไม่มีงบค่าใช้จ่าย</Card>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="รายรับเดือนนี้"
          value={formatBaht(thisMonth.income)}
          tone="income"
          sublabel={`เดือนก่อน ${formatBaht(previousMonth.income)} บาท`}
        />
        <MetricCard
          label="รายจ่ายเดือนนี้"
          value={formatBaht(thisMonth.expense)}
          tone="expense"
          sublabel={`เดือนก่อน ${formatBaht(previousMonth.expense)} บาท`}
        />
      </div>

      {pendingCount !== undefined && (
        <Link to="/owner" className="block rounded-xl border border-amber/30 bg-amber-light p-4 text-sm font-semibold text-amber hover:border-amber">
          มี {pendingCount} รายการรอตรวจสอบ · ไปหน้าตรวจสอบ
        </Link>
      )}

      <details className="rounded-xl border border-paperLine bg-white p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-700">
          ดูกราฟและรายการอนุมัติล่าสุด
        </summary>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0 p-4">
          <h3 className="mb-3 text-base font-semibold">รายรับและรายจ่าย · 6 เดือน</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#D7E3F3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#53657A" }} />
              <YAxis tick={{ fontSize: 12, fill: "#53657A" }} tickFormatter={(value) => Number(value).toLocaleString("th-TH")} />
              <Tooltip formatter={(value) => [`${formatBaht(value)} บาท`]} />
              <Bar dataKey="income" name="รายรับ" fill="#16A34A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="รายจ่าย" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="min-w-0 p-4">
          <h3 className="mb-3 text-base font-semibold">ยอดสุทธิรายเดือน · 6 เดือน</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#D7E3F3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#53657A" }} />
              <YAxis tick={{ fontSize: 12, fill: "#53657A" }} tickFormatter={(value) => Number(value).toLocaleString("th-TH")} />
              <Tooltip formatter={(value) => [`${formatBaht(value)} บาท`, "สุทธิ"]} />
              <Line type="monotone" dataKey="net" name="สุทธิ" stroke="#2563EB" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-base font-semibold">รายการอนุมัติล่าสุด</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-inkSoft">ยังไม่มีรายการที่อนุมัติ</p>
        ) : (
          <ul className="divide-y divide-paperLine">
            {recent.map((transaction) => (
              <li key={transaction.id} className="flex min-w-0 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{transaction.itemDescription}</p>
                  <p className="text-xs text-inkSoft">{transaction.category || "ไม่ระบุหมวด"} · {transaction.createdByName}</p>
                </div>
                <span className={`shrink-0 font-nums text-sm font-semibold ${transaction.type === "income" ? "text-green-800" : "text-red-700"}`}>
                  {transaction.type === "income" ? "+" : "-"}{formatBaht(transaction.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </details>
    </section>
  );
}
