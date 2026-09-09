import { TYPE_LABEL } from "../lib/format";

const STYLES = {
  income: "bg-teal-light text-teal-dark",
  expense: "bg-rust-light text-rust",
};

export default function TypeBadge({ type }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
        STYLES[type] || "bg-paper text-inkSoft"
      }`}
    >
      {TYPE_LABEL[type] || type}
    </span>
  );
}
