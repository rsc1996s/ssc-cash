import { formatBaht, formatDate, formatDateTime } from "../lib/format";
import { lineTotal, transferredAgainst } from "../lib/transfers";
import { ORGANIZATION } from "../config/org";
import { withdrawalReportRows } from "./withdrawalReportData";

function changedAfterCreate(request) {
  if (!request.createdAt || !request.updatedAt) return false;
  const created = request.createdAt.toMillis?.() ?? new Date(request.createdAt).getTime();
  const updated = request.updatedAt.toMillis?.() ?? new Date(request.updatedAt).getTime();
  return Number.isFinite(created) && Number.isFinite(updated) && Math.abs(updated - created) > 1000;
}

export default function WithdrawalRequestDocument({
  request,
  isOwner = false,
  payments = [],
  groupByCategory = false,
  showNote = true,
}) {
  const lines = request.lines || [];
  const total = request.totalAmount ?? lineTotal(lines);
  const paid = isOwner ? transferredAgainst(request.id, payments) : 0;
  const remaining = total - paid;
  const hasChanges = changedAfterCreate(request);
  const reportRows = withdrawalReportRows(lines, groupByCategory);
  const lineRow = (line, index) => (
    <tr key={`${line.lineNo || index + 1}-${index}`} className="print-row border-b border-paperLine/70 odd:bg-blue-50/35">
      <td className="w-12 py-2 pr-2 font-nums">{line.lineNo || index + 1}</td>
      <td className="w-[30%] break-words py-2 pr-2">{line.categoryLabel || "-"}</td>
      <td className="break-words py-2 pr-2">{line.description}</td>
      <td className="w-28 whitespace-nowrap py-2 text-right font-nums">{formatBaht(line.amount)}</td>
    </tr>
  );

  return (
    <div className="text-sm">
      <header className="mb-5 border-b-2 border-ink pb-4">
        <div className="mb-2 flex items-center justify-center gap-3 text-center">
          {ORGANIZATION.logoUrl && <img src={ORGANIZATION.logoUrl} alt="" className="max-h-14 max-w-20 object-contain" />}
          <div>
            <p className="text-base font-semibold">{ORGANIZATION.name}</p>
            <h1 className="mt-1 text-xl font-bold">รายการค่าใช้จ่ายเสนอเพื่อรอชำระ</h1>
          </div>
        </div>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <p><span className="text-inkSoft">บัญชีต้นทาง:</span> {request.sourceAccountLabel}</p>
          <p><span className="text-inkSoft">เลขที่ใบเบิก:</span> <span className="font-nums">{request.requestNo}</span></p>
          <p><span className="text-inkSoft">วันที่:</span> {formatDate(request.date)}</p>
          <p><span className="text-inkSoft">ผู้เสนอ:</span> {request.createdByName || "-"}</p>
        </div>
        {showNote && request.note && (
          <p className="mt-2 break-words"><span className="text-inkSoft">หมายเหตุ:</span> {request.note}</p>
        )}
      </header>

      <table className="withdrawal-report-table w-full table-fixed border-y border-paperLine">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="w-12 py-2 pr-2">ลำดับ</th>
            <th className="w-[30%] py-2 pr-2">รายการ (หมวด)</th>
            <th className="py-2 pr-2">รายละเอียด</th>
            <th className="w-28 py-2 text-right">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {reportRows.map((entry, index) => {
            if (entry.type === "line") return lineRow(entry.line, entry.index);
            if (entry.type === "category") {
              return <tr key={`category-${entry.category}`} className="break-inside-avoid bg-blue-50 font-semibold"><td colSpan={4} className="py-2">{entry.category}</td></tr>;
            }
            return (
              <tr key={`subtotal-${entry.category}`} className="break-inside-avoid border-b border-paperLine bg-slate-50 text-right font-medium">
                <td colSpan={3} className="py-2 pr-2">ยอดย่อย {entry.category}</td>
                <td className="py-2 font-nums">{formatBaht(entry.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ml-auto mt-4 w-full max-w-sm space-y-1 text-right">
        <p className="font-semibold">ยอดรวมรอชำระ <span className="ml-3 font-nums">{formatBaht(total)} บาท</span></p>
        {isOwner && (
          <>
            <p>ยอดโอนจ่ายแล้ว <span className="ml-3 font-nums">{formatBaht(paid)} บาท</span></p>
            <p className="font-semibold">คงเหลือ <span className="ml-3 font-nums">{formatBaht(remaining)} บาท</span></p>
          </>
        )}
      </div>

      <div className="print-signatures mt-12 grid grid-cols-3 gap-5 text-center">
        {["ผู้เสนอ", "ผู้ตรวจสอบ", "ผู้อนุมัติ"].map((label) => (
          <div key={label} className="px-1">
            <div className="mb-2 h-12" />
            <div className="border-t border-ink pt-1">{label}</div>
            <div className="mt-1 text-xs text-inkSoft">{label === "ผู้เสนอ" ? request.createdByName : "\u00a0"}</div>
          </div>
        ))}
      </div>
      <footer className="print-metadata mt-6 border-t border-paperLine pt-2 text-center text-xs text-inkSoft">
        <p>
          สร้างเมื่อ {request.createdAt ? formatDateTime(request.createdAt) : "-"} โดย {request.createdByName || "-"}
          {" · "}
          {hasChanges
            ? `แก้ไขล่าสุด ${formatDateTime(request.updatedAt)}`
            : "แก้ไขล่าสุด: ไม่มี"}
          {hasChanges && <span className="ml-2 font-semibold text-amber">มีการแก้ไข</span>}
        </p>
      </footer>
    </div>
  );
}
