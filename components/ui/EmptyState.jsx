export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center rounded-xl border border-dashed border-paperLine bg-white px-6 ${compact ? "py-4" : "py-12"} text-center`}>
      {Icon && (
        <span className={`flex items-center justify-center rounded-full bg-blue-50 text-blue-600 ${compact ? "mb-2 h-9 w-9" : "mb-4 h-14 w-14"}`}>
          <Icon size={compact ? 20 : 26} strokeWidth={1.6} />
        </span>
      )}
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      {description && <p className="max-w-xs text-sm text-inkSoft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
