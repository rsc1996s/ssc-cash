import { STATUS_LABEL } from "../../lib/format";

const COLORS = {
  pending: "bg-amber-light text-amber",
  approved: "bg-green-50 text-green-800",
  rejected: "bg-red-50 text-red-700",
  voided: "bg-slate-100 text-slate-700",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${COLORS[status] || "bg-slate-100 text-slate-700"}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}
