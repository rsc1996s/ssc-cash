import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { bangkokDate } from "../lib/businessDate";
import { calculateFundDashboard } from "../lib/dashboardCash";
import { isActiveFund } from "../lib/cashStatus";
import { formatBaht } from "../lib/format";
import CashFlowChart from "./CashFlowChart";
import MetricCard from "./MetricCard";
import Input from "./ui/Input";
import Sheet from "./ui/Sheet";

export default function FundDashboard({ funds, topups, transactions, pendingHref }) {
  const [selectedId, setSelectedId] = useState("");
  const [month, setMonth] = useState(() => bangkokDate().slice(0, 7));
  const [choosing, setChoosing] = useState(false);
  const [choosingMonth, setChoosingMonth] = useState(false);
  const fund = funds.find((item) => item.id === selectedId) || funds[0];
  const summary = useMemo(
    () => fund ? calculateFundDashboard(fund, topups, transactions, month) : null,
    [fund, topups, transactions, month]
  );
  const pendingCount = fund ? transactions.filter((item) => item.fundId === fund.id && item.status === "pending").length : 0;
  const [year, monthNumber] = month.split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));

  if (!fund) return <section className="mb-3">
    <h1 className="mb-4 text-2xl font-semibold">ภาพรวม</h1>
    <p className="rounded-xl border border-paperLine bg-white p-4 text-sm text-inkSoft">ไม่มีงบที่แสดงได้</p>
  </section>;

  return (
    <section aria-label="แดชบอร์ดแยกตามงบ" className="mb-3 min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">ภาพรวม</h1>
        <div className="flex min-w-0 flex-wrap gap-2">
          <button type="button" onClick={() => setChoosing(true)} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-paperLine bg-white px-3 text-left text-sm">
            <span className="text-inkSoft">งบที่ดู</span>
            <span className="break-words font-semibold">{fund.label}{!isActiveFund(fund) && " (ปิดใช้งาน)"}</span>
            <ChevronDown size={16} className="shrink-0" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setChoosingMonth(true)} className="flex min-h-11 items-center gap-2 rounded-lg border border-paperLine bg-white px-3 text-left text-sm">
            <span className="text-inkSoft">เดือน</span>
            <span className="whitespace-nowrap font-semibold">{monthLabel}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <MetricCard compact alignRight label="คงเหลือสิ้นเดือน" value={`${formatBaht(summary.balance)} บาท`} icon={Wallet} tone="primary"
          sublabel={`ยกมาต้นเดือน ${formatBaht(summary.opening)} บาท`} />
        <MetricCard compact alignRight label="เงินเข้ารวม" value={`${formatBaht(summary.received)} บาท`} icon={ArrowUpRight} tone="income"
          sublabel={`เติมงบ ${formatBaht(summary.topup)} · รายรับที่อนุมัติ ${formatBaht(summary.income)} บาท`} />
        <MetricCard compact alignRight label="ใช้ไป" value={`${formatBaht(summary.expense)} บาท`} icon={ArrowDownRight} tone="expense"
          sublabel="เฉพาะรายการที่อนุมัติแล้ว" />
      </div>
      {pendingCount > 0 && <div className="mb-3 rounded-lg border border-warning/40 bg-warning-light p-3 text-sm text-warning">
        มี {pendingCount} รายการรออนุมัติ (ยังไม่รวมในยอดด้านบน)
        {pendingHref && (pendingHref.startsWith("#")
          ? <a href={pendingHref} className="ml-2 inline-flex min-h-11 items-center font-semibold underline">ดูรายการ</a>
          : <Link to={pendingHref} className="ml-2 inline-flex min-h-11 items-center font-semibold underline">ดูรายการ</Link>)}
      </div>}
      {summary.invalidCount > 0 && <p role="alert" className="mb-2 rounded-lg bg-warning-light p-2 text-xs text-warning">
        มี {summary.invalidCount} รายการที่วันที่หรือจำนวนเงินไม่ถูกต้อง จึงไม่รวมในแดชบอร์ด กรุณาตรวจสอบข้อมูล
      </p>}
      <CashFlowChart data={summary.months} />
      <details className="text-xs text-inkSoft">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">ⓘ วิธีคำนวณยอด</summary>
        <p>
        ใช้วันที่ทำรายการและวันที่เติมเงิน (รายการเก่าใช้วันที่บันทึก) เงินเติมนับทันที ส่วนรายรับและรายจ่ายนับเฉพาะที่อนุมัติ
        {" "}หากบันทึกเงินก้อนเดียวกันทั้งเติมเงินและรายรับ ระบบจะนับทั้งสองรายการ
        {" "}ยอดยกมาใช้ยอดตั้งต้นปัจจุบัน เช่นเดียวกับ Statement ส่วนปิดยอดรายวันยังใช้เวลาบันทึกหรืออนุมัติ
        </p>
      </details>
      <Sheet open={choosing} title="เลือกงบที่ต้องการดู" onClose={() => setChoosing(false)}>
        <div className="space-y-2">
          {funds.map((item) => (
            <button key={item.id} type="button" onClick={() => {
              setSelectedId(item.id);
              setChoosing(false);
            }} aria-pressed={item.id === fund.id} className={`min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm ${item.id === fund.id ? "border-blue-600 bg-blue-50 font-semibold text-blue-800" : "border-paperLine"}`}>
              {item.label}{!isActiveFund(item) && " (ปิดใช้งาน)"}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={choosingMonth} title="เลือกเดือน" onClose={() => setChoosingMonth(false)}>
        <label className="block text-sm font-medium">
          เดือนที่ต้องการดู
          <Input type="month" value={month} max={bangkokDate().slice(0, 7)} onChange={(event) => {
            if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value);
          }} className="mt-2" />
        </label>
      </Sheet>
    </section>
  );
}
