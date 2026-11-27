import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import useScopedCashData from "../hooks/useScopedCashData";
import { bangkokDate, parseBangkokDate } from "../lib/businessDate";
import { isActiveFund } from "../lib/cashStatus";
import { createFundTopup, newFundTopupRef } from "../lib/createFundTopup";
import { formatBaht } from "../lib/format";
import { currentFundBalance } from "../lib/ledger";
import { parseSatang } from "../lib/money";
import { matchingRecentTopups } from "../lib/topupData";
import { matchingIncomeTransactions } from "./incomeDuplicates";
import PossibleIncomeDuplicates from "./PossibleIncomeDuplicates";
import FormHeader from "./ui/FormHeader";
import Input from "./ui/Input";
import SearchPicker from "./ui/SearchPicker";
import Sheet from "./ui/Sheet";
import { useFeedback } from "./ui/FeedbackProvider";

export default function TopUpDialog({ onClose, lockedFundId = "", initialFundId = "" }) {
  const { user, profile, isOwner } = useAuth();
  const { funds, topups, transactions, loading, error: loadError } = useScopedCashData();
  const { confirm, toast } = useFeedback();
  const [initialDate] = useState(() => bangkokDate());
  const [draft, setDraft] = useState(() => ({
    fundId: lockedFundId || initialFundId || "", date: initialDate, amount: "", note: "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const attempt = useRef(null);
  const busyRef = useRef(false);
  const activeFunds = useMemo(() => funds.filter(isActiveFund), [funds]);

  useEffect(() => {
    if (!attempted) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempted]);

  const fund = activeFunds.find((item) => item.id === draft.fundId);
  const balance = fund ? currentFundBalance(fund, topups, transactions) : null;
  let amountSatang = null;
  try { amountSatang = parseSatang(draft.amount); } catch { /* Invalid drafts are validated on submit. */ }
  const possibleIncomes = matchingIncomeTransactions(draft, transactions);
  const recentTopups = matchingRecentTopups(draft, topups);

  function update(field, value) {
    setError("");
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function close() {
    if (busyRef.current) return;
    if ((attempt.current || draft.amount || draft.note || draft.date !== initialDate) && !await confirm({
      title: "ยกเลิกการเติมเงิน",
      description: attempt.current
        ? "ระบบยังยืนยันผลการบันทึกไม่ได้ หากออกไปกรุณาตรวจประวัติการเติมก่อนสร้างรายการใหม่"
        : "ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ออกจากฟอร์ม", cancelLabel: "ทำต่อ", danger: true,
    })) return;
    onClose();
  }

  async function submit(event) {
    event.preventDefault();
    if (busyRef.current) return;
    setError("");
    if (!isOwner || profile?.disabled || !user) {
      setError("เฉพาะเจ้าของร้านที่ใช้งานได้เท่านั้นที่เติมเงินได้");
      return;
    }
    if (attempt.current && attempt.current.user.uid !== user.uid) {
      setError("บัญชีผู้ใช้เปลี่ยน กรุณากลับเข้าสู่ระบบด้วยบัญชีเดิมเพื่อตรวจผลการบันทึก");
      return;
    }
    let date = attempt.current?.date;
    let satang;
    if (!attempt.current) {
      if (loading || loadError) {
        setError("ยังตรวจสอบรายการเดิมไม่ได้ กรุณารอข้อมูลหรือโหลดหน้าใหม่");
        return;
      }
      if (!fund) {
        setError("กรุณาเลือกงบที่ยังใช้งาน");
        document.getElementById("topup-fund")?.focus();
        return;
      }
      date = parseBangkokDate(draft.date);
      if (!date || draft.date > bangkokDate()) {
        setError("กรุณาเลือกวันที่เติมเงินที่ถูกต้องและไม่เกินวันนี้");
        document.getElementById("fund-topup-date")?.focus();
        return;
      }
      try { satang = parseSatang(draft.amount); }
      catch (err) {
        setError(err.message);
        document.getElementById("fund-topup-amount")?.focus();
        return;
      }
      if (draft.note.trim().length > 2000) {
        setError("หมายเหตุยาวเกิน 2,000 ตัวอักษร");
        document.getElementById("fund-topup-note")?.focus();
        return;
      }
    }

    busyRef.current = true;
    setBusy(true);
    try {
      if (!attempt.current && (possibleIncomes.length || recentTopups.length) && !await confirm({
        title: "ตรวจสอบเงินเข้าที่อาจซ้ำ",
        description: "พบรายรับที่ตรงกันหรือเงินเติมยอดเดียวกันภายใน 10 นาที หากเป็นเงินก้อนเดียวกันไม่ควรบันทึกซ้ำ",
        confirmLabel: "เป็นคนละรายการ บันทึกต่อ", cancelLabel: "กลับไปตรวจสอบ",
      })) return;
      const retry = Boolean(attempt.current);
      if (!retry) {
        attempt.current = {
          ref: newFundTopupRef(), fundId: fund.id, amount: satang / 100,
          date, note: draft.note.trim(), user, profile,
        };
        setAttempted(true);
      }
      const result = await createFundTopup({ ...attempt.current, user, profile, retry });
      attempt.current = null;
      setAttempted(false);
      toast(result.alreadyRecorded ? "พบรายการที่บันทึกไว้แล้ว กรุณาตรวจประวัติ" : "เติมเงินเข้างบค่าใช้จ่ายแล้ว");
      onClose();
    } catch (err) {
      console.error("เติมเงินเข้างบไม่สำเร็จ:", err);
      setError(err.message === "งบนี้ถูกปิดใช้งานแล้ว ไม่สามารถเติมเงิน"
        ? err.message
        : "ยังยืนยันผลการบันทึกไม่ได้ กรุณาลองอีกครั้งหรือตรวจประวัติก่อนสร้างรายการใหม่");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return <Sheet open={isOwner} title="เติมเงินเข้างบ" onClose={close}
    panelClassName="h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85dvh] sm:max-w-[560px]"
    header={<div className="px-4 sm:px-6 lg:px-0"><FormHeader title="เติมเงินเข้างบ" onCancel={close} formId="fund-topup-form"
      saving={busy} saveDisabled={!attempted && (loading || Boolean(loadError))} saveLabel={attempted ? "ลองอีกครั้ง" : "บันทึก"} /></div>}>
    <form id="fund-topup-form" noValidate onSubmit={submit} onKeyDown={(event) => {
      if (event.key === "Enter") event.preventDefault();
    }} className="space-y-4">
      <p className="rounded-lg border border-paperLine bg-paper p-4 text-sm">
        สำหรับเงินที่เจ้าของจัดสรรมาใช้จ่าย ยอดงบเพิ่มทันที หากเป็นรายรับจากการดำเนินงานให้บันทึกรายรับแทน เงินก้อนเดียวกันบันทึกเพียงครั้งเดียว
      </p>
      <fieldset disabled={busy || attempted} className="space-y-4">
        <div>
          {lockedFundId
            ? <p className="mb-1 text-sm font-semibold">งบปลายทาง</p>
            : <label htmlFor="topup-fund" className="mb-1 block text-sm font-semibold">งบปลายทาง</label>}
          {lockedFundId
            ? <p id="topup-fund" className="break-words rounded-lg border border-paperLine bg-slate-50 p-3">{fund?.label || "ไม่พบงบที่ใช้งาน"}</p>
            : <SearchPicker id="topup-fund" value={draft.fundId} onChange={(value) => update("fundId", value)}
              options={activeFunds.map((item) => ({ value: item.id, label: item.label }))}
              ariaLabel="งบปลายทาง" placeholder="เลือกงบปลายทาง" disabled={busy || attempted} />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold" htmlFor="fund-topup-date">วันที่เงินเข้า
            <Input id="fund-topup-date" type="date" max={bangkokDate()} value={draft.date}
              onChange={(event) => update("date", event.target.value)} className="mt-1" />
          </label>
          <label className="block text-sm font-semibold" htmlFor="fund-topup-amount">จำนวนเงิน (บาท)
            <Input id="fund-topup-amount" type="number" inputMode="decimal" step="0.01" value={draft.amount}
              onChange={(event) => update("amount", event.target.value)} className="mt-1 font-nums" />
          </label>
        </div>
        <label className="block text-sm font-semibold" htmlFor="fund-topup-note">หมายเหตุ
          <Input id="fund-topup-note" maxLength={2000} value={draft.note}
            onChange={(event) => update("note", event.target.value)} className="mt-1" />
        </label>
      </fieldset>
      <p className="text-xs text-inkSoft">วันที่เงินเข้าใช้ในแดชบอร์ดและรายงาน ส่วนการปิดยอดรายวันอ้างอิงเวลาที่บันทึกจริง</p>
      <PossibleIncomeDuplicates entries={possibleIncomes} kind="income" />
      {recentTopups.length > 0 && <p role="status" className="rounded-lg border border-warning/40 bg-warning-light p-4 text-sm">
        พบเงินเติมยอดเดียวกันในงบนี้ภายใน 10 นาที {recentTopups.length} รายการ กรุณาตรวจประวัติก่อนบันทึก
      </p>}
      <div className="rounded-lg border border-paperLine bg-paper p-4 text-sm">
        {fund && Number.isFinite(balance)
          ? <>งบ <strong className="break-words">{fund.label}</strong> จะเพิ่มจาก <span className="font-nums">{formatBaht(balance)}</span> เป็น <span className="font-nums">{amountSatang === null ? "–" : formatBaht((Math.round(balance * 100) + amountSatang) / 100)}</span> บาท</>
          : "เลือกงบและระบุจำนวนเงินเพื่อดูยอดหลังเติม"}
      </div>
      {loadError && <p role="alert" className="text-sm text-danger">โหลดข้อมูลงบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  </Sheet>;
}
