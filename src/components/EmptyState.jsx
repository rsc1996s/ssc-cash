export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 bg-white border border-dashed border-paperLine rounded-xl">
      {Icon && (
        <span className="w-14 h-14 rounded-full bg-paper flex items-center justify-center mb-4 text-inkSoft">
          <Icon size={26} strokeWidth={1.6} />
        </span>
      )}
      <h3 className="font-slab text-base mb-1">{title}</h3>
      {description && <p className="text-sm text-inkSoft max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
