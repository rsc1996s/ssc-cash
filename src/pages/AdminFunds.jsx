import { useState } from "react";
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
import { formatBaht, formatDateTime } from "../lib/format";
import { currentFundBalance } from "../lib/ledger";
import { Pencil } from "lucide-react";
import { newAuditEvent, queueAuditEvent } from "../lib/audit";
import { useFeedback } from "../components/ui/FeedbackProvider";
import FormHeader from "../components/ui/FormHeader";
import Sheet from "../components/ui/Sheet";
import SegmentedTabs from "../components/ui/SegmentedTabs";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import useScopedCashData from "../hooks/useScopedCashData";
import { bangkokDate, formatBangkokDate, parseBangkokDate } from "../lib/businessDate";
import VoidReasonSheet from "../components/VoidReasonSheet";
import { isActiveFund, isActiveTopup } from "../lib/cashStatus";

export default function AdminFunds() {
  const { user, profile } = useAuth();
  const { confirm, toast } = useFeedback();
  const { funds, topups, transactions, error: loadError } = useScopedCashData();

  const [newFund, setNewFund] = useState({ label: "", openingBalance: "" });
  const [topupDraft, setTopupDraft] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ label: "", openingBalance: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState("funds");
  const [topupFundId, setTopupFundId] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);

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
      <SegmentedTabs
        value={section}
        onChange={setSection}
        ariaLabel="จัดการงบค่าใช้จ่าย"
        className="mb-4"
        options={[
          { value: "funds", label: "งบค่าใช้จ่าย" },
          { value: "create", label: "เพิ่มงบ" },
        ]}
      />

      {section === "funds" && <div className="space-y-4 mb-8">
        {funds.map((f) => {
          const balance = currentFundBalance(f, topups, transactions);
          return (
            <Card key={f.id} className="p-4 sm:p-5">
              {editingId === f.id ? (
                <div className="mb-3">
                  <FormHeader
                    title="แก้ไขงบค่าใช้จ่าย"
                    onCancel={cancelEdit}
                    onSave={() => saveEdit(f.id)}
                    saving={busy}
                    saveLabel="บันทึก"
                  />
                  <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-inkSoft block mb-1">ชื่อฝั่ง</label>
                      <Input
                        value={editDraft.label}
                        onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                        className="w-full border border-paperLine rounded px-3 py-2 text-sm focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-inkSoft block mb-1">ยอดเงินตั้งต้น (บาท)</label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={editDraft.openingBalance}
                        onChange={(e) => setEditDraft((d) => ({ ...d, openingBalance: e.target.value }))}
                        className="w-full border border-paperLine rounded px-3 py-2 text-sm font-nums focus:border-primary"
                      />
                    </div>
                  </div>
                  {error && <p className="text-sm text-danger mb-2">{error}</p>}
                </div>
              ) : (
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold">{f.label}</div>
                      {!isActiveFund(f) && <span className="rounded bg-slate-100 px-2 py-1 text-xs text-inkSoft">ปิดใช้งาน</span>}
                      {isActiveFund(f) && <button
                        onClick={() => startEdit(f)}
                        className="text-inkSoft hover:text-primary p-1 -m-1"
                        title="แก้ไขฝั่งนี้"
                      >
                        <Pencil size={14} />
                      </button>}
                    </div>
                    <div className="text-xs text-inkSoft">
                      ยอดตั้งต้น {formatBaht(f.openingBalance)} บาท
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-inkSoft">ยอดคงเหลือปัจจุบัน</div>
                    <div className="font-nums text-2xl text-primary">{formatBaht(balance)}</div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => openTopup(f.id)}
                disabled={!isActiveFund(f)}
                className="mt-3 min-h-11 w-full rounded-lg border border-paperLine text-sm font-medium text-blue-700 disabled:opacity-50"
              >
                เติมเงินเข้างบนี้
              </button>

              <details className="mt-3">
                <summary className="text-xs text-inkSoft cursor-pointer">ประวัติการเติมเงิน</summary>
                <ul className="text-xs text-inkSoft mt-2 space-y-1">
                  {topups
                    .filter((t) => t.fundId === f.id)
                    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                    .map((t) => (
                      <li key={t.id}>
                        +{formatBaht(t.amount)} บาท โดย {t.createdByName} ·{" "}
                        {t.topupDate ? `วันที่เติม ${formatBangkokDate(t.topupDate)} · ` : "ไม่ได้ระบุวันที่เติม · "}
                        บันทึก {formatDateTime(t.createdAt)} {t.note && `(${t.note})`}{" "}
                        {isActiveTopup(t) ? (
                          <button type="button" onClick={() => setVoidTarget({ kind: "topup", item: t })} className="min-h-11 px-2 font-semibold text-danger">ยกเลิกเงินเติม</button>
                        ) : (
                          <span className="text-danger">ยกเลิกแล้ว · {t.voidReason} · {t.voidedByName} ({formatDateTime(t.voidedAt)})</span>
                        )}
                      </li>
                    ))}
                </ul>
              </details>
              {isActiveFund(f) && (
                <button type="button" onClick={() => setVoidTarget({ kind: "fund", item: f })} className="mt-2 min-h-11 text-sm font-medium text-danger">
                  ปิดใช้งานงบ
                </button>
              )}
              {!isActiveFund(f) && <p className="mt-2 text-xs text-inkSoft">ปิดโดย {f.archivedByName} ({formatDateTime(f.archivedAt)}) · {f.archiveReason}</p>}
            </Card>
          );
        })}
      </div>}

      {section === "create" && <Card className="max-w-md p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold">เพิ่มฝั่งเงินหมุนเวียนใหม่</h2>
        <form id="create-fund-form" onSubmit={createFund} className="space-y-3">
          <FormHeader
            title="เพิ่มงบค่าใช้จ่าย"
            onCancel={async () => {
              const dirty = Boolean(newFund.label || newFund.openingBalance);
              if (dirty && !await confirm({
                title: "ยกเลิกการเพิ่มงบ",
                description: "ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
                confirmLabel: "ทิ้งข้อมูล",
                cancelLabel: "ทำต่อ",
                danger: true,
              })) return;
              setNewFund({ label: "", openingBalance: "" });
            }}
            formId="create-fund-form"
            saving={busy}
            saveLabel="บันทึก"
          />
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
      </Card>}

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
