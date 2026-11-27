import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import SearchPicker from "../components/ui/SearchPicker";
import StatusBadge from "../components/ui/StatusBadge";
import Loading from "../components/ui/Loading";
import EmptyState from "../components/ui/EmptyState";
import { useFeedback } from "../components/ui/FeedbackProvider";
import { useReceiptQueue } from "../components/ReceiptQueueProvider";
import { matchingIncomeTransactions, matchingTopups } from "../components/incomeDuplicates";
import { useAuth } from "../context/AuthContext";
import useScopedCashData from "../hooks/useScopedCashData";
import { bangkokDate, formatBusinessDate, parseBangkokDate } from "../lib/businessDate";
import { isActiveFund } from "../lib/cashStatus";
import { canViewFund } from "../lib/fundAccess";
import { formatBaht, formatDateTime, STATUS_LABEL } from "../lib/format";
import { parseSatang } from "../lib/money";
import { receiptCustomer, receiptDescription, receiptRows, receiptTotals } from "../lib/receiptData";
import ReceiptApproval from "../components/ReceiptApproval";

export default function Receipts() {
  const { user, profile, isOwner } = useAuth();
  const { funds: allFunds, topups, transactions, loading, error: loadError } = useScopedCashData();
  const { items, enqueue, retry, remove } = useReceiptQueue();
  const { confirm } = useFeedback();
  const [fundId, setFundId] = useState("");
  const [date, setDate] = useState(() => bangkokDate());
  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(null);
  const amountRef = useRef(null);
  const funds = useMemo(() => allFunds.filter((fund) => isActiveFund(fund) && canViewFund(profile, fund.id)), [allFunds, profile]);

  useEffect(() => {
    if (loading || loadError) return;
    let saved = "";
    try { saved = localStorage.getItem(`scacc-receipt-fund:${user.uid}`) || ""; }
    catch (err) { console.error("อ่านงบที่เลือกไว้ไม่สำเร็จ:", err); }
    setFundId((current) => funds.some((fund) => fund.id === current) ? current :
      funds.some((fund) => fund.id === saved) ? saved : funds[0]?.id || "");
  }, [loading, loadError, funds, user.uid]);

  function chooseFund(value) {
    setFundId(value);
    setDuplicate(null);
    try { localStorage.setItem(`scacc-receipt-fund:${user.uid}`, value); }
    catch (err) { console.error("จำงบที่เลือกไม่สำเร็จ:", err); setError("ไม่สามารถจำงบที่เลือกในเครื่องนี้ได้"); }
  }

  const rows = useMemo(() => receiptRows(transactions, { fundId, date, isOwner, uid: user.uid }), [transactions, fundId, date, isOwner, user.uid]);
  const queued = items.filter((item) => item.uid === user.uid);
  const customerOptions = useMemo(() => [...new Set(transactions
    .filter((entry) => entry.type === "income" && entry.paymentMethod === "transfer")
    .map((entry) => receiptCustomer(entry.itemDescription)).filter(Boolean))]
    .map((name) => ({ value: name, label: name })), [transactions]);

  let totals;
  try { totals = receiptTotals(rows); }
  catch (err) { totals = null; console.error("สรุปยอดรับโอนไม่สำเร็จ:", err); }

  function addToQueue(draft) {
    enqueue(draft);
    setAmount("");
    setCustomer("");
    setReference("");
    setDuplicate(null);
    setError("");
    amountRef.current?.focus();
  }

  function submit(event) {
    event.preventDefault();
    setError("");
    const fund = funds.find((entry) => entry.id === fundId);
    try {
      if (!fund || loading || loadError) throw new Error("กรุณาเลือกงบที่ใช้งานได้");
      if (!parseBangkokDate(date)) throw new Error("กรุณาเลือกวันที่ที่ถูกต้อง");
      parseSatang(amount);
      receiptDescription(customer);
      if (reference.trim().length > 2000) throw new Error("หมายเหตุยาวเกิน 2,000 ตัวอักษร");
      const draft = { fund, amount, customer, reference, transactionDate: date };
      const candidates = [
        ...transactions,
        ...items.filter((entry) => entry.uid === user.uid).map((entry) => ({
          id: entry.id, fundId: entry.fund.id, amount: Number(entry.amount),
          transactionDate: entry.transactionDate, type: "income", status: "pending",
          itemDescription: receiptDescription(entry.customer),
        })),
      ];
      const matches = matchingIncomeTransactions({ fundId, amount, date }, candidates);
      const topupMatches = matchingTopups({ fundId, amount, date }, topups);
      if (matches.length || topupMatches.length) setDuplicate({ draft, matches, topupMatches });
      else addToQueue(draft);
    } catch (err) {
      setError(err.message);
      amountRef.current?.focus();
    }
  }

  async function removeFailed(item) {
    if (await confirm({
      title: "ลบรายการออกจากคิว",
      description: "หากระบบบันทึกสำเร็จแต่ไม่ได้รับคำตอบ รายการอาจอยู่ในระบบแล้ว กรุณาตรวจสอบก่อนลบออกจากคิว",
      confirmLabel: "ลบออกจากคิว", cancelLabel: "กลับไปตรวจสอบ", danger: true,
    })) remove(item.id);
  }

  const queueSection = queued.length > 0 && <section className="mb-4" aria-label="คิวบันทึกรับโอน">
    <h2 className="mb-2 text-base font-semibold">คิวบันทึก</h2>
    {queued.map((item) => <Card key={item.id} className={`mb-2 p-4 ${item.state === "failed" ? "border-danger" : ""}`}>
      <p className="break-words font-semibold">{receiptDescription(item.customer)} · <span className="font-nums">{formatBaht(item.amount)}</span> บาท</p>
      <p className="break-words text-xs text-inkSoft">{item.fund.label} · {formatBusinessDate(item.transactionDate)}</p>
      <p className={item.state === "failed" ? "text-sm text-danger" : "text-sm text-inkSoft"}>
        {item.state === "failed" ? item.error : item.state === "saving" ? "กำลังบันทึก" : "รอบันทึก"}
      </p>
      {item.state === "failed" && <div className="mt-2 flex flex-wrap gap-2"><Button onClick={() => retry(item.id)}>ลองใหม่</Button><Button variant="secondary" onClick={() => removeFailed(item)}>ลบออกจากคิว</Button></div>}
    </Card>)}
  </section>;

  if (loading) return <Layout>{queueSection}<Loading label="กำลังโหลดข้อมูลงบ" /></Layout>;
  if (loadError) return <Layout>{queueSection}<p role="alert" className="text-danger">โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและโหลดหน้าใหม่</p></Layout>;
  if (!funds.length) return <Layout>{queueSection}<EmptyState title="ยังไม่มีงบสำหรับรับโอน"
    description="ให้เจ้าของร้านสร้างงบสำหรับบัญชีรับโอนและกำหนดสิทธิ์ก่อน"
    action={isOwner && <Link className="inline-flex min-h-11 items-center text-primary underline" to="/admin/funds">ไปหน้างบค่าใช้จ่าย</Link>} /></Layout>;

  return <Layout>
    <h1 className="mb-4 text-2xl font-semibold">รับโอนจากลูกค้า</h1>
    <Link to={`/receipts/print?fund=${encodeURIComponent(fundId)}&date=${encodeURIComponent(date)}`}
      target="_blank" rel="noopener" className="mb-4 inline-flex min-h-11 items-center rounded-lg border border-paperLine bg-white px-4 text-sm font-semibold">
      รายงานรับโอนรายวัน / ส่งออก
    </Link>
    <div className="mb-4 grid grid-cols-2 gap-3">
      {["pending", "approved"].map((status) => <Card key={status} className="p-4">
        <p className="text-sm text-inkSoft">{status === "pending" ? "รอตรวจ" : "อนุมัติแล้ว"}</p>
        <p className="font-nums font-semibold">{totals ? `${totals[status].count} รายการ · ${formatBaht(totals[status].satang / 100)} บาท` : "ตรวจสอบยอดไม่สำเร็จ"}</p>
      </Card>)}
    </div>
    {!totals && <p role="alert" className="mb-4 text-danger">มีจำนวนเงินไม่ถูกต้องหรือเกินขอบเขตที่รองรับ กรุณาตรวจสอบรายการ</p>}
    <div className="grid items-start gap-4 md:landscape:grid-cols-2 lg:grid-cols-2">
      <Card className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 max-h-[65dvh] overflow-y-auto p-4 lg:top-4">
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-semibold">จำนวนเงิน (บาท)
            <Input ref={amountRef} value={amount} onChange={(event) => { setAmount(event.target.value); setDuplicate(null); }}
              inputMode="decimal" autoComplete="off" className="mt-1 h-14 text-right text-2xl font-nums" placeholder="0.00" />
          </label>
          <div><p className="mb-1 text-sm font-semibold">ชื่อลูกค้า (ถ้ามี)</p>
            <SearchPicker value={customer} onChange={(value) => { setCustomer(value); setDuplicate(null); }} options={customerOptions} ariaLabel="ชื่อลูกค้า" placeholder="เลือกหรือเพิ่มชื่อลูกค้า" clearable
              createAction={(name, { close }) => <button type="button" className="min-h-11 w-full rounded-lg border border-paperLine px-3 text-left" onClick={() => { setCustomer(name.trim()); setDuplicate(null); close(); }}>+ ใช้ชื่อ “{name}”</button>} />
          </div>
          <label className="block text-sm font-semibold">เลขอ้างอิง / หมายเหตุ (ถ้ามี)
            <Input value={reference} onChange={(event) => { setReference(event.target.value); setDuplicate(null); }} maxLength={2000} className="mt-1" />
          </label>
          <div><p className="mb-1 text-sm font-semibold">บัญชีรับเงิน (งบ)</p>
            <SearchPicker value={fundId} onChange={chooseFund} options={funds.map((fund) => ({ value: fund.id, label: fund.label }))} ariaLabel="บัญชีรับเงิน" />
          </div>
          <label className="block text-sm font-semibold">วันที่ทำรายการ
            <Input type="date" value={date} onChange={(event) => { setDate(event.target.value); setDuplicate(null); }} className="mt-1" />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {duplicate && <div role="alert" className="rounded-lg border border-warning/40 bg-warning-light p-3 text-sm">
            <p>อาจซ้ำกับ {duplicate.matches.length + duplicate.topupMatches.length} รายการที่มีงบ วันที่ และยอดตรงกัน</p>
            <ul className="mt-1 list-inside list-disc">
              {duplicate.matches.slice(0, 3).map((item) => <li key={`income-${item.id}`} className="break-words">
                {item.itemDescription || "รายรับ"} · {STATUS_LABEL[item.status] || item.status}
              </li>)}
              {duplicate.topupMatches.slice(0, Math.max(0, 3 - duplicate.matches.length)).map((item) =>
                <li key={`topup-${item.id}`} className="break-words">เติมเงินเข้างบ · {item.note || "ไม่ระบุหมายเหตุ"}</li>)}
            </ul>
            <p className="mt-1">หากเป็นเงินก้อนเดียวกัน ไม่ควรบันทึกซ้ำ</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => addToQueue(duplicate.draft)}>บันทึกต่อ</Button>
              <Button variant="secondary" onClick={() => setDuplicate(null)}>ยกเลิก</Button>
            </div>
          </div>}
          <div className="sticky bottom-0 bg-white pb-[env(safe-area-inset-bottom)] pt-2">
            <Button type="submit" className="w-full" disabled={Boolean(duplicate)}>ยืนยัน</Button>
          </div>
        </form>
      </Card>
      <section>
        <h2 className="mb-3 text-lg font-semibold">รายการตามวันที่เลือก</h2>
        {queueSection}
        {isOwner && <ReceiptApproval rows={rows} />}
        {!rows.length && <p className="text-sm text-inkSoft">ไม่มีรายการในวันที่เลือก</p>}
        <div className="space-y-2">{rows.map((row) => <Card key={row.id} className="p-4">
          <Link to={`/transaction/${row.id}`} className="block min-h-11">
            <div className="flex justify-between gap-2">
              <div className="min-w-0"><p className="break-words font-semibold">{row.itemDescription}</p>
                <p className="text-xs text-inkSoft">{formatDateTime(row.createdAt)} · {row.createdByName}</p>
                {row.note && <p className="break-words text-xs text-inkSoft">{row.note}</p>}</div>
              <div className="text-right"><p className="font-nums font-semibold">{formatBaht(row.amount)} บาท</p><StatusBadge status={row.status} /></div>
            </div>
          </Link>
        </Card>)}</div>
      </section>
    </div>
  </Layout>;
}
