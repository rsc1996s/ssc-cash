export default function SegmentedTabs({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  variant = "pill",
}) {
  const selectedStyle = "border-blue-700 bg-blue-700 text-white";
  const idleStyle = "border-paperLine bg-white text-inkSoft hover:bg-blue-50";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex min-w-0 gap-2 overflow-x-auto ${className}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-touch shrink-0 border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
            variant === "pill" ? "rounded-full" : "rounded-lg"
          } ${value === option.value ? selectedStyle : idleStyle}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
