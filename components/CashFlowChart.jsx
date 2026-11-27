import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBaht } from "../lib/format";
import Card from "./ui/Card";

export default function CashFlowChart({ data }) {
  const [tooltipActive, setTooltipActive] = useState(false);
  const noActivity = data.length > 0 && data.every((item) => item.income === 0 && item.expense === 0);
  useEffect(() => setTooltipActive(false), [data]);
  return (
    <Card className="mb-3 min-w-0 p-4">
      <h2 className="mb-2 text-base font-semibold">เงินเข้ารวมและรายจ่าย · 6 เดือน</h2>
      <p className="mb-2 text-xs text-inkSoft">เงินเข้ารวมเงินเติมงบและรายรับที่อนุมัติแล้ว</p>
      {noActivity ? <p className="py-6 text-center text-sm text-inkSoft">ไม่มีเงินเข้าหรือรายจ่ายในช่วง 6 เดือนนี้</p> :
      <div className="h-44 sm:h-52" aria-label="กราฟเงินรับเข้าและรายจ่าย 6 เดือน">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}
          onMouseMove={() => setTooltipActive(true)} onMouseLeave={() => setTooltipActive(false)}
          onTouchStart={() => setTooltipActive(true)} onTouchEnd={() => setTooltipActive(false)}>
          <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
          <XAxis dataKey="label" interval="preserveStartEnd" tick={{ fontSize: 12, fill: "rgb(var(--ink-soft))" }} />
          <YAxis width={48} tick={{ fontSize: 12, fill: "rgb(var(--ink-soft))" }} tickFormatter={(value) => Number(value).toLocaleString("th-TH", { notation: "compact", maximumFractionDigits: 1 })} />
          <Tooltip active={tooltipActive} formatter={(value) => `${formatBaht(value)} บาท`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="income" name="เงินเข้ารวม" stroke="rgb(var(--income))" strokeWidth={3} />
          <Line type="monotone" dataKey="expense" name="รายจ่าย" stroke="rgb(var(--expense))" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
      </div>}
    </Card>
  );
}
import { useEffect, useState } from "react";
