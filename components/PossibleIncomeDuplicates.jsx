import { formatBaht, STATUS_LABEL } from "../lib/format";

export default function PossibleIncomeDuplicates({ entries, kind }) {
  if (!entries.length) return null;
  return (
    <div role="status" className="rounded-lg border border-warning/40 bg-warning-light p-3 text-sm text-ink">
      <p className="font-semibold">อาจเป็นเงินก้อนเดียวกัน ({entries.length} รายการ)</p>
      <p className="mt-1">พบ{kind === "topup" ? "เงินเติมงบ" : "รายรับ"}ที่มีงบ วันที่ และจำนวนเงินตรงกัน กรุณาตรวจสอบก่อนบันทึก</p>
      <ul className="mt-2 list-inside list-disc">
        {entries.slice(0, 3).map((entry) => (
          <li key={entry.id} className="break-words">
            {kind === "topup" ? (entry.note || "ไม่ระบุหมายเหตุ") : (entry.itemDescription || "ไม่ระบุรายละเอียด")}
            {" · "}<span className="font-nums">{formatBaht(entry.amount)}</span> บาท
            {kind === "income" && ` · ${STATUS_LABEL[entry.status] || entry.status}`}
            {entry.createdByName && ` · ${entry.createdByName}`}
          </li>
        ))}
      </ul>
      {entries.length > 3 && <p className="mt-1">และอีก {entries.length - 3} รายการ</p>}
      <p className="mt-2 text-xs">เป็นเพียงรายการที่อาจซ้ำ คนละรายการอาจมียอดและวันที่ตรงกันได้ ระบบไม่ตรวจรายการต่างวันหรือต่างยอด</p>
    </div>
  );
}
