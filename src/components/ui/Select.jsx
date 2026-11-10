export default function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full rounded-lg border border-paperLine bg-white px-3 py-2.5 text-base text-ink focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
