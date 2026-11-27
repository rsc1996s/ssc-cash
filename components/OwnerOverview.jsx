import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bangkokDate } from "../lib/businessDate";
import { dashboardMonths, dashboardTopupDate, dashboardTransactionDate } from "../lib/dashboardCash";
import { currentFundBalance } from "../lib/ledger";
import { isActiveFund, isActiveTopup } from "../lib/cashStatus";
import { formatBaht } from "../lib/format";
import Card from "./ui/Card";

function classifyFund(label) {
  const name = String(label || "").replace(/\s/g, "");
  const branches = ["หน้าร้าน", "ต่างอำเภอ"].filter((branch) => name.includes(branch));
  const kinds = ["เงินสด", "บัญชี"].filter((kind) => name.includes(kind));
  return branches.length === 1 && kinds.length === 1 ? { branch: branches[0], kind: kinds[0] } : null;
}

function comparison(current, previous) {
  if (previous === 0) return current === 0 ? "เท่าเดือนก่อน" : "ไม่มีฐานเปรียบเทียบ";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "▲" : change < 0 ? "▼" : "−"} ${Math.abs(change).toLocaleString("th-TH", { maximumFractionDigits: 1 })}% จากเดือนก่อน`;
}

export default function OwnerOverview({ funds, topups, transactions, month }) {
  const [chartTab, setChartTab] = useState("chart");
  const approved = useMemo(() => transactions.filter((item) => item.status === "approved"), [transactions]);
  const { balances, unmatched, lowFunds, total } = useMemo(() => {
    const groups = {
      "หน้าร้าน": { เงินสด: null, บัญชี: null },
      "ต่างอำเภอ": { เงินสด: null, บัญชี: null },
    };
    const other = [];
    const low = [];
    let sum = 0;
    funds.forEach((fund) => {
      const balance = currentFundBalance(fund, topups, approved);
      sum += balance;
      const group = classifyFund(fund.label);
      if (isActiveFund(fund) && fund.openingBalance > 0 && balance < fund.openingBalance * 0.2) {
        low.push({ id: fund.id, label: fund.label, branch: group?.branch });
      }
      if (!group) other.push({ ...fund, balance });
      else groups[group.branch][group.kind] = (groups[group.branch][group.kind] ?? 0) + balance;
    });
    return { balances: groups, unmatched: other, lowFunds: low, total: sum };
  }, [funds, topups, approved]);

  const monthly = useMemo(() => {
    const months = dashboardMonths(month);
    const byMonth = new Map(months.map((item) => [item.key, item]));
    approved.forEach((item) => {
      const date = dashboardTransactionDate(item);
      const point = date && byMonth.get(date.slice(0, 7));
      if (point && (item.type === "income" || item.type === "expense")) {
        point[item.type] += Number(item.amount) || 0;
      }
    });
    return months;
  }, [approved, month]);
  const current = monthly.at(-1) || { income: 0, expense: 0 };
  const previous = monthly.at(-2) || { income: 0, expense: 0 };
  const { topupTotal, invalidTopups } = useMemo(() => {
    let total = 0;
    let invalid = 0;
    topups.filter(isActiveTopup).forEach((item) => {
      const date = dashboardTopupDate(item);
      const amount = Number(item.amount);
      if (!date || item.amount == null || !Number.isFinite(amount) || amount <= 0) {
        invalid += 1;
      } else if (date.slice(0, 7) === month) {
        total += amount;
      }
    });
    return { topupTotal: total, invalidTopups: invalid };
  }, [topups, month]);
  const recent = [...approved].sort((a, b) =>
    (b.reviewedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) -
    (a.reviewedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0)).slice(0, 5);
  const period = month === bangkokDate().slice(0, 7) ? "เดือนนี้" : "เดือนที่เลือก";

  return (
    <>
      <section aria-label="ยอดคงเหลือและรายรับรายจ่าย" className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <div className="min-w-0 rounded-xl bg-slate-800 p-4 text-white shadow-sm md:col-span-2 lg:col-span-4 xl:col-span-2">
          <p className="text-xs text-slate-200">คงเหลือรวมทั้งร้าน · ปัจจุบัน</p>
          <p className="mt-2 break-all font-nums text-2xl font-semibold">{formatBaht(total)}</p>
          <p className="text-xs text-slate-200">บาท</p>
        </div>
        {Object.entries(balances).map(([branch, values]) => (
          <Card key={branch} className="min-w-0 p-4 lg:col-span-4 xl:col-span-3">
            <h2 className="text-base font-semibold">{branch}</h2>
            <dl className="mt-2 space-y-1 text-xs">
              {["เงินสด", "บัญชี"].map((kind) => <div key={kind} className="flex justify-between gap-2">
                <dt className="text-inkSoft">{kind}</dt>
                <dd className="min-w-0 break-all text-right font-nums font-semibold">{values[kind] === null ? "—" : formatBaht(values[kind])}</dd>
              </div>)}
              <div className="flex justify-between gap-2 border-t border-paperLine pt-1">
                <dt className="text-inkSoft">รวม</dt>
                <dd className="min-w-0 break-all text-right font-nums font-semibold">{values.เงินสด === null && values.บัญชี === null ? "—" : formatBaht((values.เงินสด ?? 0) + (values.บัญชี ?? 0))}</dd>
              </div>
            </dl>
            {lowFunds.filter((fund) => fund.branch === branch).map((fund) =>
              <p key={fund.id} className="mt-1 break-words text-xs text-warning">งบใกล้หมด: {fund.label}</p>)}
          </Card>
        ))}
        {["income", "expense"].map((kind) => (
          <Card key={kind} className="min-w-0 p-4 lg:col-span-6 xl:col-span-2">
            <p className="text-xs text-inkSoft">{kind === "income" ? "รายรับ" : "รายจ่าย"}{period}</p>
            <p className={`mt-2 break-all font-nums text-2xl font-semibold ${kind === "income" ? "text-income" : "text-expense"}`}>{formatBaht(current[kind])}</p>
            <p className="mt-1 text-xs text-inkSoft font-nums">{comparison(current[kind], previous[kind])}</p>
            {kind === "income" && <div className="mt-2 border-t border-paperLine pt-2 text-xs text-inkSoft">
              <p>เติมงบ: <span className="font-nums">{formatBaht(topupTotal)}</span> บาท</p>
              <p>เงินเข้ารวม: <span className="font-nums">{formatBaht(topupTotal + current.income)}</span> บาท</p>
              <p>รายรับและกราฟไม่นับเงินเติมงบ</p>
            </div>}
          </Card>
        ))}
      </section>
      {invalidTopups > 0 && <p role="alert" className="mt-2 text-xs text-danger">
        ไม่รวมเงินเติมงบ {invalidTopups} รายการที่วันที่หรือจำนวนเงินไม่ถูกต้อง กรุณาตรวจสอบข้อมูล
      </p>}
      {unmatched.length > 0 && <Card className="mt-4 p-4">
        <h2 className="text-base font-semibold">งบอื่นที่ยังจัดกลุ่มไม่ได้</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unmatched.map((fund) => <li key={fund.id} className="flex min-w-0 justify-between gap-2 text-sm">
            <span className="min-w-0 break-words">{fund.label}{fund.archived === true ? " (ปิดใช้งาน)" : ""}
              {lowFunds.some((item) => item.id === fund.id) && <span className="text-warning"> · งบใกล้หมด</span>}
            </span>
            <span className="shrink-0 font-nums">{formatBaht(fund.balance)}</span>
          </li>)}
        </ul>
      </Card>}
      <Card className="mt-4 min-w-0 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-4">
            <h2 className="text-base font-semibold">แนวโน้มรายรับ–รายจ่าย</h2>
            <span className="text-xs text-income">● รายรับ</span>
            <span className="text-xs text-expense">● รายจ่าย</span>
          </div>
          <div role="tablist" aria-label="ข้อมูลภาพรวม" className="flex gap-2 text-sm">
            <button type="button" role="tab" aria-selected={chartTab === "chart"} onClick={() => setChartTab("chart")}
              className={`min-h-11 px-2 ${chartTab === "chart" ? "border-b-2 border-ink font-semibold" : "text-inkSoft"}`}>กราฟ</button>
            <button type="button" role="tab" aria-selected={chartTab === "recent"} onClick={() => setChartTab("recent")}
              className={`min-h-11 px-2 ${chartTab === "recent" ? "border-b-2 border-ink font-semibold" : "text-inkSoft"}`}>อนุมัติล่าสุด</button>
          </div>
        </div>
        {chartTab === "chart" ? (
          <div className="h-[168px] min-w-0 font-nums" aria-label="กราฟรายรับและรายจ่ายที่อนุมัติแล้วตามวันที่ทำรายการ">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgb(var(--ink-soft))" }} />
                <YAxis tick={{ fontSize: 12, fill: "rgb(var(--ink-soft))" }} tickFormatter={(value) => Number(value).toLocaleString("th-TH")} />
                <Tooltip formatter={(value) => `${formatBaht(value)} บาท`} />
                <Line type="monotone" dataKey="income" name="รายรับ" stroke="rgb(var(--income))" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="expense" name="รายจ่าย" stroke="rgb(var(--expense))" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="max-h-[200px] overflow-y-auto">
          {recent.length === 0 ? <p className="py-4 text-sm text-inkSoft">ยังไม่มีรายการที่อนุมัติ</p> :
            <ul className="divide-y divide-paperLine">{recent.map((item) => <li key={item.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{item.itemDescription}</span>
              <span className={`shrink-0 font-nums ${item.type === "income" ? "text-income" : "text-expense"}`}>{item.type === "income" ? "+" : "−"}{formatBaht(item.amount)}</span>
            </li>)}</ul>}
        </div>}
      </Card>
    </>
  );
}
