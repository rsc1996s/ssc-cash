import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { STATUS_LABEL } from "../lib/format";
import Button from "./ui/Button";
import Input from "./ui/Input";
import SearchPicker from "./ui/SearchPicker";
import Sheet from "./ui/Sheet";

const DATE_PRESETS = [
  { value: "all", label: "ทุกช่วง" },
  { value: "today", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "custom", label: "กำหนดเอง" },
];

export default function TransactionFilterPanel({
  filters,
  updateFilter,
  clearFilters,
  categories,
  authors,
  funds = [],
  totals,
  count,
  showAuthor = true,
  showStatus = true,
  statusOptions = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
  onExport,
}) {
  const [open, setOpen] = useState(false);
  const hasFilters = filters.search || filters.datePreset !== "all" ||
    filters.fund !== "all" || filters.category !== "all" || filters.status !== "all" || filters.author !== "all";

  return (
    <section className="mb-4 rounded-xl border border-paperLine bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkSoft" />
          <Input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="ค้นหารายการ"
            aria-label="ค้นหารายการ"
            className="pl-10 text-sm"
          />
        </div>
        <Button
          variant={open || hasFilters ? "secondary" : "ghost"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="shrink-0 px-3"
        >
          <SlidersHorizontal size={17} />
          กรอง
        </Button>
        {onExport && (
          <Button variant="secondary" onClick={onExport} className="shrink-0 px-3">
            ส่งออก
          </Button>
        )}
      </div>

      <Sheet
        open={open}
        title="กรองรายการ"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-3">
            {hasFilters ? (
              <Button variant="ghost" onClick={clearFilters} className="px-2 text-red-700">
                <X size={16} /> ล้าง
              </Button>
            ) : <span />}
            <Button onClick={() => setOpen(false)}>ใช้ตัวกรอง</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            ช่วงวันที่
            <SearchPicker
              value={filters.datePreset}
              onChange={(value) => updateFilter("datePreset", value)}
              options={DATE_PRESETS}
              placeholder="เลือกช่วงวันที่"
              ariaLabel="ช่วงวันที่"
            />
          </label>
          {filters.datePreset === "custom" && (
            <>
              <label className="text-sm font-medium">
                ตั้งแต่วันที่
                <Input type="date" value={filters.fromDate} onChange={(event) => updateFilter("fromDate", event.target.value)} className="mt-1 text-sm" />
              </label>
              <label className="text-sm font-medium">
                ถึงวันที่
                <Input type="date" value={filters.toDate} onChange={(event) => updateFilter("toDate", event.target.value)} className="mt-1 text-sm" />
              </label>
            </>
          )}
          <label className="text-sm font-medium">
            หมวดหมู่
            <SearchPicker
              value={filters.category}
              onChange={(value) => updateFilter("category", value)}
              options={[{ value: "all", label: "ทุกหมวดหมู่" }, ...categories.map((category) => ({ value: category, label: category }))]}
              placeholder="ทุกหมวดหมู่"
              ariaLabel="หมวดหมู่"
            />
          </label>
          {funds.length > 0 && (
            <label className="text-sm font-medium">
              งบค่าใช้จ่าย
              <SearchPicker
                value={filters.fund}
                onChange={(value) => updateFilter("fund", value)}
                options={[{ value: "all", label: "ทุกงบค่าใช้จ่าย" }, ...funds.map((fund) => ({ value: fund.id, label: fund.label }))]}
                placeholder="ทุกงบค่าใช้จ่าย"
                ariaLabel="งบค่าใช้จ่าย"
              />
            </label>
          )}
          {showStatus && (
            <label className="text-sm font-medium">
              สถานะ
              <SearchPicker
                value={filters.status}
                onChange={(value) => updateFilter("status", value)}
                options={[{ value: "all", label: "ทุกสถานะ" }, ...statusOptions]}
                placeholder="ทุกสถานะ"
                ariaLabel="สถานะ"
              />
            </label>
          )}
          {showAuthor && (
            <label className="text-sm font-medium">
              ผู้บันทึก
              <SearchPicker
                value={filters.author}
                onChange={(value) => updateFilter("author", value)}
                options={[{ value: "all", label: "ทุกคน" }, ...authors.map((author) => ({ value: author, label: author }))]}
                placeholder="ทุกคน"
                ariaLabel="ผู้บันทึก"
              />
            </label>
          )}
        </div>
      </Sheet>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-paperLine pt-3 text-sm">
        <span className="text-inkSoft">พบ {count} รายการ</span>
        <div className="flex gap-4 font-semibold">
          <span className="text-green-800">รับ {totals.income.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
          <span className="text-red-700">จ่าย {totals.expense.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </section>
  );
}
