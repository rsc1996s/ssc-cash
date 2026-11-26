import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { bangkokDate } from "../lib/businessDate";
import { calculateFundDashboard } from "../lib/dashboardCash";
import { isActiveFund } from "../lib/cashStatus";
import { formatBaht } from "../lib/format";
import CashFlowChart from "./CashFlowChart";
import MetricCard from "./MetricCard";
import Input from "./ui/Input";
import Sheet from "./ui/Sheet";

export default function FundDashboard({ funds, topups, transactions }) {
  const [selectedId, setSelectedId] = useState("");
  const [month, setMonth] = useState(() => bangkokDate().slice(0, 7));
  const [choosing, setChoosing] = useState(false);
  const fund = funds.find((item) => item.id === selectedId) || funds[0];
  const summary = useMemo(
    () => fund ? calculateFundDashboard(fund, topups, transactions, month) : null,
    [fund, topups, transactions, month]
  );

  if (!fund) return <p className="mb-3 rounded-lg border border-paperLine bg-white p-3 text-sm text-inkSoft">ไม่มีงบที่แสดงได้</p>;

  return (
    <section aria-label="แดชบอร์ดแยกตามงบ" className="mb-3 min-w-0">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-inkSoft">งบที่คุณดูแล</p>
          <button type="button" onClick={() => setChoosing(true)} className="min-h-11 w-full rounded-lg border border-paperLine bg-white px-3 text-left text-sm font-semibold text-blue-800">
            <span className="block truncate">{fund.label}{!isActiveFund(fund) && " (ปิดใช้งาน)"} · เปลี่ยนงบ</span>
          </button>
        </div>
        <label className="w-40 max-w-full text-xs text-inkSoft">
          เดือนที่ต้องการดู
          <Input type="month" value={month} max={bangkokDate().slice(0, 7)} onChange={(event) => {
            if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value);
          }} className="mt-1 min-h-11 py-2" />
        </label>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <MetricCard compact label="คงเหลือสิ้นเดือน" value={`${formatBaht(summary.balance)} บาท`} icon={Wallet} tone="primary" />
        </div>
        <MetricCard compact label="เงินรับเข้าในเดือน" value={formatBaht(summary.received)} icon={ArrowUpRight} tone="income" />
        <MetricCard compact label="ใช้ไปในเดือน" value={formatBaht(summary.expense)} icon={ArrowDownRight} tone="expense" />
      </div>
      <p className="mb-2 text-xs text-inkSoft">
        ยกมาต้นเดือน {formatBaht(summary.opening)} · เติมเงิน {formatBaht(summary.topup)} · รายรับ {formatBaht(summary.income)} บาท
      </p>
      {summary.invalidCount > 0 && <p role="alert" className="mb-2 rounded-lg bg-warning-light p-2 text-xs text-warning">
        มี {summary.invalidCount} รายการที่วันที่หรือจำนวนเงินไม่ถูกต้อง จึงไม่รวมในแดชบอร์ด กรุณาตรวจสอบข้อมูล
      </p>}
      <CashFlowChart data={summary.months} />
      <p className="text-xs text-inkSoft">
        ใช้วันที่ทำรายการและวันที่เติมเงิน (รายการเก่าใช้วันที่บันทึก) เงินเติมนับทันที ส่วนรายรับและรายจ่ายนับเฉพาะที่อนุมัติ
        {" "}หากบันทึกเงินก้อนเดียวกันทั้งเติมเงินและรายรับ ระบบจะนับทั้งสองรายการ
        {" "}ยอดยกมาใช้ยอดตั้งต้นปัจจุบัน เช่นเดียวกับ Statement ส่วนปิดยอดรายวันยังใช้เวลาบันทึกหรืออนุมัติ
      </p>
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
    </section>
  );
}
