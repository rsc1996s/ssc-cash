import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

/**
 * Dropdown แบบ popup ที่ค้นหาได้ทันที พิมพ์คำที่อยู่ตรงไหนของชื่อก็เจอ (substring match)
 * เช่น พิมพ์ "เดิน" เจอ "ค่าใช้จ่ายเกี่ยวกับการเดินทาง", พิมพ์ "สาร" เจอ "เอกสาร"
 *
 * options: [{ value, label, sublabel? }]
 */
export default function Combobox({
  value,
  onChange,
  options,
  placeholder = "— เลือก —",
  searchPlaceholder = "พิมพ์เพื่อค้นหา...",
  className = "",
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function pick(opt) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 border border-paperLine rounded px-3 py-2 text-sm bg-white text-left hover:border-teal focus:border-teal disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? "text-ink truncate" : "text-inkSoft truncate"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-inkSoft shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[240px] bg-white border border-paperLine rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b border-paperLine px-3 py-2">
            <Search size={15} className="text-inkSoft shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full text-sm outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-inkSoft">ไม่พบผลลัพธ์</li>
            )}
            {filtered.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(o)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left ${
                    i === highlight ? "bg-teal-light" : ""
                  }`}
                >
                  <span className="truncate">
                    {o.label}
                    {o.sublabel && <span className="text-inkSoft"> · {o.sublabel}</span>}
                  </span>
                  {o.value === value && <Check size={15} className="text-teal shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
