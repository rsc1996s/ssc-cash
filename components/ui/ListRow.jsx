import { Link } from "react-router-dom";

export default function ListRow({
  to,
  onClick,
  leading,
  title,
  description,
  meta,
  trailing,
  className = "",
  children,
}) {
  const classNames = `flex min-h-touch min-w-0 items-center gap-3 rounded-xl border border-paperLine bg-white p-3 text-left shadow-card transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${className}`;
  const content = children || (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block break-words text-base font-medium text-ink">{title}</span>
        {description && <span className="mt-0.5 block break-words text-sm text-inkSoft">{description}</span>}
        {meta && <span className="mt-0.5 block break-words text-xs text-inkSoft">{meta}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </>
  );

  if (to) return <Link to={to} className={classNames}>{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={classNames}>{content}</button>;
  return <div className={classNames}>{content}</div>;
}
