export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-paperLine bg-white px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Icon size={26} strokeWidth={1.6} />
        </span>
      )}
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      {description && <p className="max-w-xs text-sm text-inkSoft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
