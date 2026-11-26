import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBaht } from "../lib/format";
import Card from "./ui/Card";

export default function CashFlowChart({ data }) {
  return (
    <Card className="mb-3 min-w-0 p-3">
      <h2 className="mb-1 text-sm font-semibold">เงินรับเข้าและรายจ่ายที่อนุมัติ · 6 เดือน</h2>
      <div className="h-32 sm:h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#D7E3F3" vertical={false} />
          <XAxis dataKey="label" interval={0} padding={{ left: 18, right: 20 }} tick={{ fontSize: 10, fill: "#53657A" }} />
          <YAxis tick={{ fontSize: 11, fill: "#53657A" }} tickFormatter={(value) => Number(value).toLocaleString("th-TH")} />
          <Tooltip formatter={(value) => `${formatBaht(value)} บาท`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="income" name="เงินรับเข้า" stroke="#15803D" strokeWidth={3} />
          <Line type="monotone" dataKey="expense" name="รายจ่าย" stroke="#DC2626" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </Card>
  );
}
