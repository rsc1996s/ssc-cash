import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PrintSheet from "../components/PrintSheet";
import Button from "../components/ui/Button";
import SearchPicker from "../components/ui/SearchPicker";
import Input from "../components/ui/Input";
import Loading from "../components/ui/Loading";
import useScopedCashData from "../hooks/useScopedCashData";
import { useAuth } from "../context/AuthContext";
import { ORGANIZATION } from "../config/org";
import { bangkokDate, formatBangkokDate, parseBangkokDate } from "../lib/businessDate";
import { canViewFund } from "../lib/fundAccess";
import { formatBaht, formatDateTime, STATUS_LABEL } from "../lib/format";
import { sumSatang } from "../lib/money";
import { receiptRows, receiptTotals } from "../lib/receiptData";
import { downloadCsv } from "../components/csvExport";

export default function ReceiptReport() {
  const { user, profile, isOwner } = useAuth();
  const { funds, transactions, loading, error } = useScopedCashData();
  const [params] = useSearchParams();
  const [fundId, setFundId] = useState(params.get("fund") || "");
  const [date, setDate] = useState(params.get("date") || bangkokDate());
  const allowedFunds = funds.filter((fund) => canViewFund(profile, fund.id));
  const fund = allowedFunds.find((item) => item.id === fundId);
  const rows = useMemo(() => receiptRows(transactions, { fundId, date, isOwner, uid: user.uid }), [transactions, fundId, date, isOwner, user.uid]);
  let totals;
  let extraTotals;
  try {
    totals = receiptTotals(rows);
    const otherStatuses = [...new Set(rows.map((row) => row.status).filter((status) => status !== "pending" && status !== "approved"))];
    extraTotals = otherStatuses.map((status) => {
      const entries = rows.filter((row) => row.status === status);
      return { status, count: entries.length, satang: sumSatang(entries.map((row) => row.amount)) };
    });
  } catch (err) {
    console.error("สรุปรายงานรับโอนไม่สำเร็จ:", err);
  }

  function exportRows() {
    downloadCsv("รายงานรับโอนรายวัน.csv",
      ["ลำดับ", "เวลาบันทึก", "ชื่อ / รายละเอียด", "อ้างอิง", "จำนวนเงิน", "สถานะ", "ผู้บันทึก"],
      rows.map((row, index) => [index + 1, formatDateTime(row.createdAt), row.itemDescription,
        row.note, Number(row.amount), STATUS_LABEL[row.status] || row.status, row.createdByName]));
  }

  if (loading) return <Loading label="กำลังโหลดรายงานรับโอน" />;
  if (error) return <p role="alert" className="p-4 text-danger">โหลดรายงานไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ</p>;
  return <PrintSheet actions={<>
    <Button variant="secondary" onClick={exportRows} disabled={!fund || !parseBangkokDate(date) || !totals}>ส่งออก CSV</Button>
    <Button onClick={() => window.print()} disabled={!fund || !parseBangkokDate(date) || !totals}>พิมพ์รายงาน</Button>
  </>}>
    <div className="no-print mb-4 grid gap-3 sm:grid-cols-2">
      <div><p className="mb-1 text-sm font-semibold">บัญชีรับเงิน (งบ)</p>
        <SearchPicker value={fundId} onChange={setFundId} options={allowedFunds.map((item) => ({ value: item.id, label: item.label }))}
          ariaLabel="บัญชีรับเงิน" placeholder="เลือกงบ" /></div>
      <label className="text-sm font-semibold">วันที่ทำรายการ<Input className="mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </div>
    {!fund || !parseBangkokDate(date) ? <p role="alert">กรุณาเลือกงบที่เข้าถึงได้และวันที่ที่ถูกต้อง</p> : !totals ? (
      <p role="alert" className="text-danger">ไม่สามารถรวมยอดได้ กรุณาตรวจสอบจำนวนเงินในรายการ</p>
    ) : <>
      <header className="mb-4 text-center">
        <p className="font-semibold">{ORGANIZATION.name}</p>
        <h1 className="text-xl font-semibold">รายงานรับโอนรายวัน</h1>
        <p className="text-sm">{fund.label} · {formatBangkokDate(parseBangkokDate(date))}</p>
        {!isOwner && <p className="text-sm">เฉพาะรายการที่บันทึกโดยผู้ใช้นี้</p>}
      </header>
      <table className="withdrawal-report-table w-full table-fixed text-sm">
        <thead><tr className="border-b border-ink">
          <th className="w-[8%] py-2 text-left">ลำดับ</th><th className="w-[18%] text-left">เวลาบันทึก</th>
          <th className="w-[30%] text-left">ชื่อ / อ้างอิง</th><th className="w-[15%] text-right">ยอด</th>
          <th className="w-[14%] text-left">สถานะ</th><th className="w-[15%] text-left">ผู้บันทึก</th>
        </tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.id} className="border-b border-paperLine align-top">
          <td className="py-2 font-nums">{index + 1}</td><td className="break-words">{formatDateTime(row.createdAt)}</td>
          <td className="break-words">{row.itemDescription}{row.note && <span className="block text-xs">{row.note}</span>}</td>
          <td className="break-all text-right font-nums">{formatBaht(row.amount)}</td>
          <td className="break-words">{STATUS_LABEL[row.status] || row.status}</td><td className="break-words">{row.createdByName}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="py-4 text-center text-sm">ไม่มีรายการในวันที่เลือก</p>}
      <div className="ml-auto mt-4 max-w-sm space-y-1 text-sm">
        {[{ status: "pending", ...totals.pending }, { status: "approved", ...totals.approved }, ...extraTotals].map((total) =>
          <p key={total.status} className="flex justify-between gap-2"><span>{STATUS_LABEL[total.status] || total.status} · {total.count} รายการ</span>
            <span className="font-nums">{formatBaht(total.satang / 100)} บาท</span></p>)}
      </div>
      <p className="print-signatures mt-12 text-right text-sm">ลงชื่อ ................................................ ผู้ตรวจสอบ</p>
    </>}
  </PrintSheet>;
}
