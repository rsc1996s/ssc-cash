const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function PinPad({ value, onChange, maxLength = 6, disabled }) {
  function press(d) {
    if (disabled || value.length >= maxLength) return;
    onChange(value + d);
  }
  function backspace() {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }

  return (
    <div>
      <div className="flex justify-center gap-2 mb-4">
        {Array.from({ length: maxLength }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 ${
              i < value.length ? "bg-ink border-ink" : "border-paperLine"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
        {KEYS.map((d) => (
          <button
            type="button"
            key={d}
            disabled={disabled}
            onClick={() => press(d)}
            className="py-3 rounded border border-paperLine text-lg font-nums hover:border-teal disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("0")}
          className="py-3 rounded border border-paperLine text-lg font-nums hover:border-teal disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={backspace}
          className="py-3 rounded border border-paperLine text-lg text-rust hover:border-rust disabled:opacity-50"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
