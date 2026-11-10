const VARIANTS = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 border border-transparent",
  secondary: "bg-white text-ink border border-paperLine hover:bg-blue-50",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-transparent",
  ghost: "bg-transparent text-inkSoft hover:bg-blue-50 border border-transparent",
};

export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant] || VARIANTS.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
