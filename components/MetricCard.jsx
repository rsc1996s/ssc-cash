import Card from "./ui/Card";

const TONE_STYLES = {
  income: {
    card: "bg-white border border-paperLine shadow-sm",
    iconWrap: "bg-primary-light text-primary",
    value: "text-green-700",
    label: "text-inkSoft",
  },
  expense: {
    card: "bg-white border border-paperLine shadow-sm",
    iconWrap: "bg-danger-light text-danger",
    value: "text-red-600",
    label: "text-inkSoft",
  },
  // การ์ดหลัก (เช่น คงเหลือสุทธิ) ใช้พื้นเข้มเด่นกว่า 2 การ์ดที่เหลือ เพื่อดึงสายตาไปที่ตัวเลขสำคัญที่สุด
  primary: {
    card: "aurora-hero rounded-xl border-transparent shadow-card",
    iconWrap: "bg-white/15 text-white",
    value: "text-white",
    label: "text-white/90",
  },
  neutral: {
    card: "bg-white border border-paperLine shadow-sm",
    iconWrap: "bg-paper text-inkSoft",
    value: "text-ink",
    label: "text-inkSoft",
  },
};

export default function MetricCard({ label, value, icon: Icon, tone = "neutral", sublabel, compact = false, alignRight = false }) {
  const s = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return (
    <Card className={`flex h-full min-w-0 flex-col p-4 ${s.card}`}>
      <div className="mb-2 flex h-9 min-w-0 items-center justify-between gap-2">
        <div title={label} className={`min-w-0 flex-1 truncate text-sm ${s.label}`}>{label}</div>
        {Icon && (
          <span className={`${compact ? "h-7 w-7" : "h-9 w-9"} rounded-full flex items-center justify-center shrink-0 ${s.iconWrap}`}>
            <Icon size={compact ? 15 : 18} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={`min-h-20 break-words font-nums text-3xl font-semibold leading-tight ${alignRight ? "text-right" : ""} ${s.value}`}>{value}</div>
      {sublabel && <div className={`mt-1 text-xs ${s.label}`}>{sublabel}</div>}
    </Card>
  );
}
