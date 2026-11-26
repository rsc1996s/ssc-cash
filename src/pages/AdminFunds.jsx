import { useMemo, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { formatBaht, formatDateTime, STATUS_LABEL } from "../lib/format";
import { currentFundBalance } from "../lib/ledger";
import { Pencil, Plus } from "lucide-react";
import { newAuditEvent, queueAuditEvent } from "../lib/audit";
import { useFeedback } from "../components/ui/FeedbackProvider";
import FormHeader from "../components/ui/FormHeader";
import Sheet from "../components/ui/Sheet";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import useScopedCashData from "../hooks/useScopedCashData";
import { bangkokDate, formatBangkokDate, parseBangkokDate } from "../lib/businessDate";
import VoidReasonSheet from "../components/VoidReasonSheet";
import { isActiveFund, isActiveTopup } from "../lib/cashStatus";
import { matchingIncomeTransactions, possibleIncomeDuplicateGroups } from "../components/incomeDuplicates";
import PossibleIncomeDuplicates from "../components/PossibleIncomeDuplicates";

export default function AdminFunds() {
  const { user, profile } = useAuth();
  const { confirm, toast } = useFeedback();
  const { funds, topups, transactions, loading: cashLoading, error: loadError } = useScopedCashData();

  const [newFund, setNewFund] = useState({ label: "", openingBalance: "" });
  const [topupDraft, setTopupDraft] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ label: "", openingBalance: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [topupFundId, setTopupFundId] = useState(null);
  const [historyFundId, setHistoryFundId] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [visibleDuplicateCount, setVisibleDuplicateCount] = useState(20);

  const activeTopupDraft = topupDraft[topupFundId] || {};
  const possibleIncomes = matchingIncomeTransactions({
    fundId: topupFundId, amount: activeTopupDraft.amount, date: activeTopupDraft.date,
  }, transactions);
  const duplicateGroups = useMemo(() => possibleIncomeDuplicateGroups(topups, transactions), [topups, transactions]);

  async function createFund(e) {
    e.preventDefault();
    setError("");
    if (!newFund.label.trim() || !newFund.openingBalance) {
      setError("กรุณากรอกชื่อฝั่งและยอดเงินตั้งต้น");
      document.getElementById(!newFund.label.trim() ? "new-fund-label" : "new-fund-opening")?.focus();
      return;
    }
    setBusy(true);
    try {
      const fundRef = doc(collection(db, "funds"));
      const after = {
        label: newFund.label.trim(),
        openingBalance: Number(newFund.openingBalance),
      };
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "fund-created",
        targetCollection: "funds",
        targetId: fundRef.id,
        before: null,
        after,
      });
      const batch = writeBatch(db);
      batch.set(fundRef, {
        ...after,
        createdAt: serverTimestamp(),
        auditLogId: audit.ref.id,
      });
      queueAuditEvent(batch, audit);
      await batch.commit();
      setNewFund({ label: "", openingBalance: "" });
      setCreateOpen(false);
      toast("สร้างงบค่าใช้จ่ายแล้ว");
    } catch (err) {
      console.error(err);
      setError("สร้างฝั่งเงินหมุนเวียนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function submitTopup(fundId) {
    const draft = topupDraft[fundId] || {};
    if (cashLoading || loadError) {
      setError("ยังตรวจสอบรายการเดิมไม่ได้ กรุณารอข้อมูลหรือโหลดหน้าใหม่");
      return;
    }
    const topupDate = parseBangkokDate(draft.date || "");
    if (!topupDate || draft.date > bangkokDate()) {
      setError("กรุณาเลือกวันที่เติมเงินที่ถูกต้องและไม่เกินวันนี้");
      document.getElementById("fund-topup-date")?.focus();
      return;
    }
    if (!draft.amount || Number(draft.amount) <= 0) {
      setError("กรุณากรอกจำนวนเงินมากกว่า 0 บาท");
      document.getElementById("fund-topup-amount")?.focus();
      return;
    }
    setBusy(true);
    if (possibleIncomes.length && !await confirm({
      title: "ตรวจสอบเงินเข้าที่อาจซ้ำ",
      description: "พบรายรับที่มีงบ วันที่ และจำนวนเงินตรงกัน หากเป็นเงินก้อนเดียวกันไม่ควรบันทึกซ้ำ",
      confirmLabel: "เป็นคนละรายการ บันทึกต่อ",
      cancelLabel: "กลับไปตรวจสอบ",
    })) {
      setBusy(false);
      return;
    }
    setError("");
    try {
      const topupRef = doc(collection(db, "fundTopups"));
      const after = { fundId, amount: Number(draft.amount), topupDate: Timestamp.fromDate(topupDate) };
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "fund-topup-created",
        targetCollection: "fundTopups",
        targetId: topupRef.id,
        before: null,
        after,
      });
      const fundRef = doc(db, "funds", fundId);
      await runTransaction(db, async (batch) => {
        const fundSnapshot = await batch.get(fundRef);
        if (!fundSnapshot.exists() || fundSnapshot.data().archived === true) {
          throw new Error("งบนี้ถูกปิดใช้งานแล้ว ไม่สามารถเติมเงิน");
        }
        batch.set(topupRef, {
          ...after,
          note: (draft.note || "").trim(),
          createdBy: user.uid,
          createdByName: profile?.name || user.email,
          createdAt: serverTimestamp(),
          auditLogId: audit.ref.id,
        });
        batch.update(fundRef, {
          lastCreatedTopupId: topupRef.id,
          topupCreatedAt: serverTimestamp(),
        });
        queueAuditEvent(batch, audit);
      });
      setTopupDraft((d) => ({ ...d, [fundId]: null }));
      setTopupFundId(null);
      toast("เติมเงินเข้างบค่าใช้จ่ายแล้ว");
    } catch (err) {
      console.error(err);
      setError(err.message === "งบนี้ถูกปิดใช้งานแล้ว ไม่สามารถเติมเงิน"
        ? err.message : "เติมเงินเข้างบค่าใช้จ่ายไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(fund) {
    setEditingId(fund.id);
    setEditDraft({ label: fund.label, openingBalance: String(fund.openingBalance) });
    setError("");
  }

  async function cancelEdit() {
    const fund = funds.find((item) => item.id === editingId);
    if (fund && (editDraft.label !== fund.label || editDraft.openingBalance !== String(fund.openingBalance))) {
      if (!await confirm({
        title: "ยกเลิกการแก้ไข",
        description: "ข้อมูลที่แก้ไขแต่ยังไม่บันทึกจะหายไป",
        confirmLabel: "ทิ้งข้อมูล",
        cancelLabel: "ทำต่อ",
        danger: true,
      })) return;
    }
    setEditingId(null);
  }

  async function cancelCreate() {
    if ((newFund.label || newFund.openingBalance) && !await confirm({
      title: "ยกเลิกการเพิ่มงบ",
      description: "ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล", cancelLabel: "ทำต่อ", danger: true,
    })) return;
    setNewFund({ label: "", openingBalance: "" });
    setError("");
    setCreateOpen(false);
  }

  async function cancelTopup() {
    const draft = topupDraft[topupFundId] || {};
    if ((draft.amount || draft.note || draft.date !== draft.initialDate) && !await confirm({
      title: "ยกเลิกการเติมเงิน",
      description: "ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setTopupDraft((items) => ({ ...items, [topupFundId]: null }));
    setTopupFundId(null);
  }

  function openTopup(fundId) {
    const today = bangkokDate();
    setTopupDraft((items) => ({ ...items, [fundId]: { amount: "", note: "", date: today, initialDate: today } }));
    setError("");
    setTopupFundId(fundId);
  }

  async function saveEdit(fundId) {
    if (!editDraft.label.trim() || editDraft.openingBalance === "") {
      setError("กรุณากรอกชื่อฝั่งและยอดเงินตั้งต้น");
      return;
    }
    const fund = funds.find((item) => item.id === fundId);
    if (!fund) {
      setError("ไม่พบฝั่งเงินหมุนเวียนที่ต้องการแก้ไข");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const after = {
        label: editDraft.label.trim(),
        openingBalance: Number(editDraft.openingBalance),
      };
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "fund-updated",
        targetCollection: "funds",
        targetId: fundId,
        before: { label: fund.label, openingBalance: fund.openingBalance },
        after,
      });
      const batch = writeBatch(db);
      batch.update(doc(db, "funds", fundId), {
        ...after,
        auditLogId: audit.ref.id,
      });
      queueAuditEvent(batch, audit);
      await batch.commit();
      setEditingId(null);
      toast("บันทึกการแก้ไขแล้ว");
    } catch (err) {
      console.error(err);
      setError("บันทึกการแก้ไขงบค่าใช้จ่ายไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function voidSelected(reasonText) {
    if (voidTarget.kind === "fund") {
      const token = await user.getIdToken();
      const response = await fetch("/.netlify/functions/archive-fund", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fundId: voidTarget.item.id, reason: reasonText }),
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("ไม่พบฟังก์ชันปิดงบ กรุณาตรวจสอบการ deploy ฟังก์ชัน Netlify");
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ปิดงบไม่สำเร็จ");
      toast("ปิดใช้งานงบแล้ว");
      return;
    }
    const topup = voidTarget.item;
    const audit = newAuditEvent({
      actorUid: user.uid,
      actorName: profile?.name || user.email,
      action: "fund-topup-voided",
      targetCollection: "fundTopups",
      targetId: topup.id,
      before: { fundId: topup.fundId, amount: topup.amount, status: "active" },
      after: { fundId: topup.fundId, amount: topup.amount, status: "voided", reason: reasonText },
    });
    const batch = writeBatch(db);
    batch.update(doc(db, "fundTopups", topup.id), {
      status: "voided", voidedBy: user.uid, voidedByName: profile?.name || user.email,
      voidedAt: serverTimestamp(), voidReason: reasonText, auditLogId: audit.ref.id,
    });
    queueAuditEvent(batch, audit);
    await batch.commit();
    toast("ยกเลิกการเติมเงินแล้ว");
  }

  return (
    <Layout>
      <PageHeader title="งบค่าใช้จ่ายหมุนเวียน" fallbackTo="/" />
      {loadError && <p role="alert" className="mb-4 text-sm text-danger">โหลดข้อมูลงบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ</p>}
      <button type="button" disabled={cashLoading || Boolean(loadError)}
        onClick={() => { setVisibleDuplicateCount(20); setDuplicateReviewOpen(true); }}
        className="mb-4 min-h-11 rounded-lg border border-paperLine bg-white px-4 text-sm font-semibold text-ink disabled:opacity-50">
        ตรวจสอบเงินเข้าที่อาจซ้ำ
      </button>
      <div className="mb-8 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {funds.map((f) => {
          const balance = currentFundBalance(f, topups, transactions);
          const active = isActiveFund(f);
          const label = f.label || "ไม่ระบุชื่องบ";
          const openingLabel = Number(f.openingBalance) < 0
            ? `−${formatBaht(Math.abs(f.openingBalance))}`
            : formatBaht(f.openingBalance);
          return (
            <Card key={f.id} className={`flex h-full min-w-0 flex-col p-4 ${active ? "" : "!bg-slate-50"}`}>
              <div className="flex h-11 min-w-0 items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-base font-semibold" title={label}>{label}</h2>
                {active ? <button type="button" onClick={() => startEdit(f)}
                  aria-label={`แก้ไขงบ ${label}`} title="แก้ไขงบ"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-inkSoft hover:bg-primary-light hover:text-primary">
                  <Pencil size={18} />
                </button> : <span aria-hidden="true" className="h-11 w-11 shrink-0" />}
              </div>
              <div className="flex h-8 items-center">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${active ? "bg-green-50 text-green-800" : "bg-slate-200 text-slate-700"}`}>
                  {active ? "ใช้งาน" : "ปิดใช้งาน"}
                </span>
              </div>
              <div className="mt-4 min-w-0">
                <p className="whitespace-nowrap text-xs text-inkSoft">ยอดคงเหลือปัจจุบัน</p>
                <p className={`min-h-[4.5rem] break-all font-nums text-3xl ${balance < 0 ? "text-danger" : "text-primary"}`}>
                  {balance < 0 ? `−${formatBaht(Math.abs(balance))}` : formatBaht(balance)}
                </p>
                <p className={`truncate text-xs ${Number(f.openingBalance) < 0 ? "text-danger" : "text-inkSoft"}`} title={`ยอดตั้งต้น ${openingLabel} บาท`}>
                  ยอดตั้งต้น <span className="font-nums">{openingLabel}</span> บาท
                </p>
              </div>
              <div className="mt-auto pt-4">
                <button type="button" onClick={() => openTopup(f.id)} disabled={!active}
                  className="min-h-11 w-full rounded-lg border border-paperLine bg-white text-sm font-semibold text-primary-dark hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50">
                  เติมเงินเข้างบนี้
                </button>
              </div>
              <div className="mt-4 border-t border-paperLine pt-2">
                <button type="button" onClick={() => setHistoryFundId(f.id)}
                  className="min-h-11 w-full rounded-lg px-2 text-sm text-inkSoft hover:bg-primary-light">
                  ประวัติการเติมเงิน
                </button>
                {active ? <button type="button" onClick={() => setVoidTarget({ kind: "fund", item: f })}
                  className="min-h-11 w-full rounded-lg border border-paperLine bg-white px-2 text-sm font-medium text-danger hover:bg-danger-light">
                  ปิดใช้งานงบ
                </button> : <button type="button" onClick={() => setHistoryFundId(f.id)}
                  className="min-h-11 w-full rounded-lg border border-paperLine bg-white px-2 text-sm font-medium text-inkSoft hover:bg-primary-light">
                  รายละเอียดการปิดใช้งาน
                </button>}
              </div>
            </Card>
          );
        })}
        <button type="button" onClick={() => { setError(""); setCreateOpen(true); }}
          className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-white p-4 text-sm font-semibold text-blue-700 hover:bg-blue-50">
          <Plus aria-hidden="true" size={24} /> เพิ่มงบค่าใช้จ่าย
        </button>
      </div>

      <Sheet open={Boolean(editingId)} title="แก้ไขงบค่าใช้จ่าย" onClose={cancelEdit}
        header={<FormHeader title="แก้ไขงบค่าใช้จ่าย" onCancel={cancelEdit}
          onSave={() => saveEdit(editingId)} saving={busy} saveLabel="บันทึก" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">ชื่อฝั่ง
            <Input value={editDraft.label} onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))} className="mt-1" />
          </label>
          <label className="block text-sm">ยอดเงินตั้งต้น (บาท)
            <Input type="number" inputMode="decimal" step="0.01" value={editDraft.openingBalance}
              onChange={(e) => setEditDraft((d) => ({ ...d, openingBalance: e.target.value }))} className="mt-1 font-nums" />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </Sheet>

      <Sheet open={Boolean(historyFundId)} title="ประวัติการเติมเงิน" onClose={() => setHistoryFundId(null)}>
        {historyFundId && <>
          {funds.filter((fund) => fund.id === historyFundId && !isActiveFund(fund)).map((fund) =>
            <p key={fund.id} className="mb-4 text-sm text-inkSoft">ปิดโดย {fund.archivedByName} ({formatDateTime(fund.archivedAt)}) · {fund.archiveReason}</p>)}
          <ul className="space-y-2 text-sm text-inkSoft">
            {topups.filter((t) => t.fundId === historyFundId)
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
              .map((t) => (
                <li key={t.id} className="rounded-lg border border-paperLine p-3">
                  +{formatBaht(t.amount)} บาท โดย {t.createdByName} ·{" "}
                  {t.topupDate ? `วันที่เติม ${formatBangkokDate(t.topupDate)} · ` : "ไม่ได้ระบุวันที่เติม · "}
                  บันทึก {formatDateTime(t.createdAt)} {t.note && `(${t.note})`}{" "}
                  {isActiveTopup(t) ? (
                    <button type="button" onClick={() => setVoidTarget({ kind: "topup", item: t })}
                      className="min-h-11 rounded-lg border border-paperLine bg-white px-3 font-semibold text-danger hover:bg-danger-light">ยกเลิกเงินเติม</button>
                  ) : (
                    <span className="text-danger">ยกเลิกแล้ว · {t.voidReason} · {t.voidedByName} ({formatDateTime(t.voidedAt)})</span>
                  )}
                </li>
              ))}
          </ul>
          {!topups.some((t) => t.fundId === historyFundId) && <p className="text-sm text-inkSoft">ยังไม่มีประวัติการเติมเงิน</p>}
        </>}
      </Sheet>

      <Sheet open={duplicateReviewOpen} title="ตรวจสอบเงินเข้าที่อาจซ้ำ" onClose={() => setDuplicateReviewOpen(false)}>
        <p className="mb-4 text-sm text-inkSoft">
          แสดงเงินเติมงบและรายรับที่มีงบ วันที่ และจำนวนเงินตรงกัน รวมรายการรอตรวจสอบด้วย
          อาจเป็นคนละรายการได้ กรุณาตรวจหลักฐานก่อนแก้ไข ระบบไม่ลบหรือเปลี่ยนข้อมูลให้อัตโนมัติ
          {" "}ไม่ครอบคลุมรายการต่างวัน ต่างยอด หรือข้อมูลวันที่ไม่ถูกต้อง
        </p>
        {duplicateGroups.length === 0 ? <p className="text-sm">ไม่พบรายการที่มีงบ วันที่ และยอดตรงกัน</p> : (
          <div className="space-y-4">
            {duplicateGroups.slice(0, visibleDuplicateCount).map((group) => (
              <section key={group.key} className="rounded-lg border border-paperLine p-4 text-sm">
                <h3 className="break-words font-semibold">{funds.find((fund) => fund.id === group.fundId)?.label || "ไม่ระบุชื่องบ"}</h3>
                <p className="mt-1 text-inkSoft">{formatBangkokDate(parseBangkokDate(group.date))} · <span className="font-nums">{formatBaht(group.amount)}</span> บาท</p>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">เงินเติมงบ {group.topups.length} รายการ</summary>
                  <ul className="list-inside list-disc space-y-1">
                    {group.topups.map((entry) => <li key={entry.id} className="break-words">{entry.note || "ไม่ระบุหมายเหตุ"} · {entry.createdByName || "ไม่ระบุผู้บันทึก"} · บันทึก {formatDateTime(entry.createdAt)}</li>)}
                  </ul>
                </details>
                <details>
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">รายรับ {group.incomes.length} รายการ</summary>
                  <ul className="list-inside list-disc space-y-1">
                    {group.incomes.map((entry) => <li key={entry.id} className="break-words">{entry.itemDescription || "ไม่ระบุรายละเอียด"} · {STATUS_LABEL[entry.status] || entry.status} · {entry.createdByName || "ไม่ระบุผู้บันทึก"} · บันทึก {formatDateTime(entry.createdAt)}</li>)}
                  </ul>
                </details>
              </section>
            ))}
            {duplicateGroups.length > visibleDuplicateCount && (
              <button type="button" onClick={() => setVisibleDuplicateCount((count) => count + 20)}
                className="min-h-11 w-full rounded-lg border border-paperLine bg-white px-4 font-semibold">
                ดูเพิ่มเติม ({duplicateGroups.length - visibleDuplicateCount} กลุ่ม)
              </button>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={createOpen} title="เพิ่มงบค่าใช้จ่าย" onClose={cancelCreate}
        header={<FormHeader title="เพิ่มงบค่าใช้จ่าย" onCancel={cancelCreate}
          formId="create-fund-form" saving={busy} saveLabel="บันทึก" />}>
        <form id="create-fund-form" onSubmit={createFund} className="space-y-3">
          <div>
            <label className="text-sm text-inkSoft block mb-1">ชื่อฝั่ง</label>
            <Input
                    id="new-fund-label"
                    value={newFund.label}
              onChange={(e) => setNewFund((f) => ({ ...f, label: e.target.value }))}
              placeholder="เช่น หน้าร้าน"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">ยอดเงินตั้งต้น (บาท)</label>
            <Input
              id="new-fund-opening"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={newFund.openingBalance}
              onChange={(e) => setNewFund((f) => ({ ...f, openingBalance: e.target.value }))}
              placeholder="เช่น 30000"
              className="font-nums"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </Sheet>

      <Sheet
        open={Boolean(topupFundId)}
        title="เติมเงิน"
        onClose={cancelTopup}
        header={
          <FormHeader
            title={`เติมเงิน · ${funds.find((fund) => fund.id === topupFundId)?.label || ""}`}
            onCancel={cancelTopup}
            formId="fund-topup-form"
            saving={busy}
            saveDisabled={cashLoading || Boolean(loadError)}
            saveLabel="บันทึก"
          />
        }
      >
        {topupFundId && (
          <form id="fund-topup-form" onSubmit={(event) => {
            event.preventDefault();
            submitTopup(topupFundId);
          }} onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }} className="space-y-3">
            <p className="rounded-lg border border-paperLine bg-paper p-3 text-sm">
              สำหรับเงินที่เจ้าของจัดสรรมาใช้จ่าย ยอดงบเพิ่มทันที หากเป็นรายรับจากการดำเนินงานให้บันทึกรายรับแทน
              เงินก้อนเดียวกันบันทึกเพียงครั้งเดียว
            </p>
            <label className="block text-sm">
              วันที่เติมเงิน
              <Input
                id="fund-topup-date"
                type="date"
                max={bangkokDate()}
                value={(topupDraft[topupFundId] || {}).date || ""}
                onChange={(event) => setTopupDraft((items) => ({
                  ...items,
                  [topupFundId]: { ...(items[topupFundId] || {}), date: event.target.value },
                }))}
                className="mt-1"
              />
            </label>
            <label className="block text-sm">
              จำนวนเงิน (บาท)
              <Input
                id="fund-topup-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={(topupDraft[topupFundId] || {}).amount || ""}
                onChange={(event) => setTopupDraft((items) => ({
                  ...items,
                  [topupFundId]: { ...(items[topupFundId] || {}), amount: event.target.value },
                }))}
                className="mt-1 w-full border border-paperLine rounded px-3 py-2"
              />
            </label>
            <p className="text-xs text-inkSoft">วันที่เติมใช้ในแดชบอร์ดและรายงาน ส่วนการปิดยอดรายวันอ้างอิงเวลาที่บันทึกจริง</p>
            <PossibleIncomeDuplicates entries={possibleIncomes} kind="income" />
            <label className="block text-sm">
              หมายเหตุ
              <Input
                value={(topupDraft[topupFundId] || {}).note || ""}
                onChange={(event) => setTopupDraft((items) => ({
                  ...items,
                  [topupFundId]: { ...(items[topupFundId] || {}), note: event.target.value },
                }))}
                className="mt-1 w-full border border-paperLine rounded px-3 py-2"
              />
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </form>
        )}
      </Sheet>
      <VoidReasonSheet
        open={Boolean(voidTarget)}
        title={voidTarget?.kind === "fund" ? "ปิดใช้งานงบ" : "ยกเลิกเงินเติม"}
        description={voidTarget?.kind === "fund"
          ? "งบและประวัติยังดูได้ แต่จะเพิ่มรายการหรือเติมเงินใหม่ไม่ได้ ต้องจัดการรายการที่รอตรวจก่อน"
          : "เงินเติมจะยังอยู่ในประวัติ แต่ไม่นับในยอดงบและรายงาน ยอดย้อนหลังอาจเปลี่ยน"}
        onClose={() => setVoidTarget(null)}
        onConfirm={voidSelected}
      />
    </Layout>
  );
}
