export default function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-paperLine px-3 py-2.5 text-base text-ink placeholder:text-inkSoft focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 ${className}`}
      {...props}
    />
  );
}
