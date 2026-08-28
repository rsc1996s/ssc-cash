import { STATUS_LABEL } from "../lib/format";

const COLORS = {
  pending: "text-amber",
  approved: "text-teal",
  rejected: "text-rust",
  voided: "text-inkSoft",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`stamp ${COLORS[status] || "text-inkSoft"}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}
