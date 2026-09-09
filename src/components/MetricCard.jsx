const TONE_STYLES = {
  income: {
    card: "bg-white border border-paperLine shadow-sm",
    iconWrap: "bg-teal-light text-teal",
    value: "text-ink",
    label: "text-inkSoft",
  },
  expense: {
    card: "bg-white border border-paperLine shadow-sm",
    iconWrap: "bg-rust-light text-rust",
    value: "text-ink",
    label: "text-inkSoft",
  },
  // การ์ดหลัก (เช่น คงเหลือสุทธิ) ใช้พื้นเข้มเด่นกว่า 2 การ์ดที่เหลือ เพื่อดึงสายตาไปที่ตัวเลขสำคัญที่สุด
  primary: {
    card: "bg-ink shadow-sm",
    iconWrap: "bg-white/10 text-white",
    value: "text-white",
    label: "text-paper/60",
  },
  neutral: {
    card: "bg-white border border-paperLine shadow-sm",
    iconWrap: "bg-paper text-inkSoft",
    value: "text-ink",
    label: "text-inkSoft",
  },
};

export default function MetricCard({ label, value, icon: Icon, tone = "neutral", sublabel }) {
  const s = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return (
    <div className={`rounded-xl p-5 ${s.card}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`text-sm ${s.label}`}>{label}</div>
        {Icon && (
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${s.iconWrap}`}>
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={`font-nums text-2xl sm:text-3xl font-semibold leading-tight ${s.value}`}>{value}</div>
      {sublabel && <div className={`text-xs mt-1 ${s.label}`}>{sublabel}</div>}
    </div>
  );
}
