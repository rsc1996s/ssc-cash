import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBaht } from "../lib/format";
import Card from "./ui/Card";

export default function CashFlowChart({ transactions }) {
  const data = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() + index - 5, 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }),
        income: 0,
        expense: 0,
      };
    });
    const byMonth = new Map(months.map((month) => [month.key, month]));
    transactions.forEach((transaction) => {
      if (transaction.status !== "approved" || !["income", "expense"].includes(transaction.type)) return;
      const value = transaction.reviewedAt || transaction.createdAt;
      const date = value?.toDate ? value.toDate() : new Date(value);
      if (!value || Number.isNaN(date.getTime())) return;
      const month = byMonth.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (month) month[transaction.type] += Number(transaction.amount) || 0;
    });
    return months;
  }, [transactions]);

  return (
    <Card className="mb-3 min-w-0 p-3">
      <h2 className="mb-1 text-sm font-semibold">รายรับและรายจ่ายที่อนุมัติ · 6 เดือน</h2>
      <div className="h-32 sm:h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#D7E3F3" vertical={false} />
          <XAxis dataKey="label" interval={0} padding={{ left: 18, right: 20 }} tick={{ fontSize: 10, fill: "#53657A" }} />
          <YAxis tick={{ fontSize: 11, fill: "#53657A" }} tickFormatter={(value) => Number(value).toLocaleString("th-TH")} />
          <Tooltip formatter={(value) => `${formatBaht(value)} บาท`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="income" name="รายรับ" stroke="#15803D" strokeWidth={3} />
          <Line type="monotone" dataKey="expense" name="รายจ่าย" stroke="#DC2626" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </Card>
  );
}
