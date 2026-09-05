import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { formatBaht } from "../lib/format";

const AXIS_STYLE = { fontSize: 11, fill: "#4A5A68" };

function shortDate(d) {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function shortBaht(n) {
  return Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export default function OverviewCharts({ statement, fromDate }) {
  const trendData = useMemo(() => {
    if (!statement) return [];
    const points = [{ label: `ยกมา ${shortDate(fromDate)}`, balance: statement.openingBalance }];
    statement.entries.forEach((e) => {
      points.push({ label: shortDate(e.date), balance: e.balance });
    });
    return points;
  }, [statement, fromDate]);

  const categoryData = useMemo(() => {
    if (!statement) return [];
    const totals = {};
    statement.entries
      .filter((e) => e.kind === "expense")
      .forEach((e) => {
        const key = e.category || "ไม่ระบุหมวดหมู่";
        totals[key] = (totals[key] || 0) + Math.abs(e.amount);
      });
    return Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [statement]);

  if (!statement || statement.entries.length === 0) return null;

  return (
    <div className="no-print grid md:grid-cols-2 gap-4 mt-4">
      <div className="bg-white border border-paperLine rounded-lg p-4 receipt-edge">
        <h3 className="font-slab text-sm mb-3">แนวโน้มยอดคงเหลือ</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#D8D6CC" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} interval="preserveStartEnd" />
            <YAxis tick={AXIS_STYLE} width={70} tickFormatter={(v) => shortBaht(v)} />
            <Tooltip
              formatter={(v) => [`${formatBaht(v)} บาท`, "คงเหลือ"]}
              contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#D8D6CC" }}
            />
            <Line type="monotone" dataKey="balance" stroke="#1F6F5C" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {categoryData.length > 0 && (
        <div className="bg-white border border-paperLine rounded-lg p-4 receipt-edge">
          <h3 className="font-slab text-sm mb-3">รายจ่ายตามหมวดหมู่ (ช่วงที่เลือก)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={categoryData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid stroke="#D8D6CC" horizontal={false} />
              <XAxis type="number" tick={AXIS_STYLE} tickFormatter={(v) => shortBaht(v)} />
              <YAxis type="category" dataKey="category" tick={AXIS_STYLE} width={110} />
              <Tooltip
                formatter={(v) => [`${formatBaht(v)} บาท`, "รวม"]}
                contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#D8D6CC" }}
              />
              <Bar dataKey="total" fill="#A83232" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
