import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import Input from "./Input";
import Sheet from "./Sheet";
import { matchesSearch, normalizeSearchText } from "./searchText";

export default function SearchPicker({
  value,
  onChange,
  options,
  placeholder = "เลือก...",
  searchPlaceholder = "พิมพ์เพื่อค้นหา",
  ariaLabel = "เลือกข้อมูล",
  disabled = false,
  clearable = false,
  helperText,
  createAction,
  isExactMatch,
  noResultsText = "ไม่พบ",
  id,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(
    () => options.filter((option) => matchesSearch(
      query,
      option.searchText ?? `${option.label} ${option.sublabel || ""}`
    )),
    [options, query]
  );
  const exactMatch = isExactMatch
    ? isExactMatch(query, options)
    : options.some((option) => normalizeSearchText(option.label) === normalizeSearchText(query));
  const showCreateAction = Boolean(createAction && normalizeSearchText(query) && !exactMatch);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    if (window.matchMedia("(min-width: 640px)").matches) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function choose(option) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    }
  }

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-paperLine bg-white px-3 py-2.5 text-left text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-inkSoft"}`}>
          {selected?.label || (typeof value === "string" && value ? value : placeholder)}
        </span>
        <ChevronDown size={18} className="shrink-0 text-inkSoft" />
      </button>
      <Sheet
        open={open}
        title={ariaLabel}
        onClose={() => setOpen(false)}
        header={
          <div className="border-b border-paperLine bg-white px-4 pb-3 pt-1 sm:pt-4">
            <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
              <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{ariaLabel}</h2>
              <button
                type="button"
                aria-label="ปิดรายการเลือก"
                onClick={() => setOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-inkSoft hover:bg-blue-50"
              >
                ×
              </button>
            </div>
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-inkSoft" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                aria-label={`ค้นหา${ariaLabel}`}
                className="pl-10"
              />
            </div>
            {helperText && <p className="mt-2 text-xs text-inkSoft">{helperText}</p>}
          </div>
        }
      >
        <div className="space-y-2">
          {clearable && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="min-h-12 w-full rounded-lg border border-paperLine px-3 text-left text-sm text-inkSoft hover:bg-blue-50"
            >
              ล้างค่า
            </button>
          )}
          {showCreateAction && createAction(query, { close: () => setOpen(false) })}
          <div ref={listRef} role="listbox" aria-label={ariaLabel} className="max-h-[55dvh] space-y-1 overflow-y-auto">
            {filtered.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                data-index={index}
                onClick={() => choose(option)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-blue-50 ${
                  index === activeIndex ? "bg-blue-50" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{option.label}</span>
                  {option.sublabel && <span className="block break-words text-xs text-inkSoft">{option.sublabel}</span>}
                </span>
                {value === option.value && <Check size={18} aria-label="เลือกอยู่" className="shrink-0 text-blue-700" />}
              </button>
            ))}
            {filtered.length === 0 && !showCreateAction && (
              <p role="status" className="rounded-lg bg-paper px-3 py-4 text-center text-sm text-inkSoft">{noResultsText}</p>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
