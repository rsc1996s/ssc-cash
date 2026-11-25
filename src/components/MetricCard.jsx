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
    card: "aurora-hero rounded-hero border-transparent shadow-glow",
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

export default function MetricCard({ label, value, icon: Icon, tone = "neutral", sublabel, compact = false }) {
  const s = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return (
    <Card className={`${compact ? "p-3" : "p-4 sm:p-5"} ${s.card}`}>
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-1" : "mb-3"}`}>
        <div className={`text-sm ${s.label}`}>{label}</div>
        {Icon && (
          <span className={`${compact ? "h-7 w-7" : "h-9 w-9"} rounded-full flex items-center justify-center shrink-0 ${s.iconWrap}`}>
            <Icon size={compact ? 15 : 18} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={`break-words font-nums font-semibold leading-tight ${compact ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"} ${s.value}`}>{value}</div>
      {sublabel && <div className={`mt-1 text-xs ${s.label}`}>{sublabel}</div>}
    </Card>
  );
}
