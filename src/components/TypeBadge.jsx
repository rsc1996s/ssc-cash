import { TYPE_LABEL } from "../lib/format";

const STYLES = {
  income: "bg-green-50 text-green-800",
  expense: "bg-red-50 text-red-700",
};

export default function TypeBadge({ type }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        STYLES[type] || "bg-paper text-inkSoft"
      }`}
    >
      {TYPE_LABEL[type] || type}
    </span>
  );
}
