export default function SectionTitle({ title, description, action, className = "" }) {
  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-snug">{title}</h2>
        {description && <p className="mt-1 text-sm text-inkSoft">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
