import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
  writeBatch,
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

function CashCategoryManager() {
  const { confirm, toast } = useFeedback();
  const [categories, setCategories] = useState([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cashCategories"), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!label.trim()) {
      setError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "cashCategories"), {
        label: label.trim(),
        createdAt: serverTimestamp(),
      });
      setLabel("");
      setFormOpen(false);
      toast("เพิ่มหมวดหมู่แล้ว");
    } catch (addError) {
      console.error(addError);
      setError("เพิ่มหมวดหมู่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function cancelAdd() {
    if (label.trim() && !await confirm({
      title: "ยกเลิกการเพิ่มหมวดหมู่",
      description: "ชื่อหมวดหมู่ที่กรอกไว้จะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setLabel("");
    setError("");
    setFormOpen(false);
  }

  async function remove(id) {
    if (!await confirm({
      title: "ลบหมวดหมู่",
      description: "ลบหมวดหมู่นี้?",
      confirmLabel: "ลบหมวดหมู่",
      danger: true,
    })) return;
    await deleteDoc(doc(db, "cashCategories", id));
    toast("ลบหมวดหมู่แล้ว");
  }

  return (
    <div className="bg-white border border-paperLine rounded-lg p-5 max-w-md mt-6">
      <h2 className="font-slab text-base mb-1">หมวดหมู่รายการเงินสด</h2>
      <p className="text-xs text-inkSoft mb-3">
        ใช้เลือกเร็วตอนบันทึกรายรับ-รายจ่ายเงินสด เช่น ค่าวัตถุดิบ, ค่าน้ำมัน, ค่าขนส่ง
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.slice(0, visibleCount).map((c) => (
          <span
            key={c.id}
            className="text-xs bg-paper border border-paperLine rounded-full px-3 py-1 flex items-center gap-2"
          >
            {c.label}
            <button onClick={() => remove(c.id)} className="text-rust">
              ×
            </button>
          </span>
        ))}
        {categories.length === 0 && <p className="text-sm text-inkSoft">ยังไม่มีหมวดหมู่</p>}
      </div>
      {categories.length > visibleCount && (
        <button type="button" onClick={() => setVisibleCount((count) => count + 20)} className="mb-3 text-sm text-blue-700">
          ดูเพิ่มเติม ({categories.length - visibleCount})
        </button>
      )}
      <button type="button" onClick={() => setFormOpen(true)} className="min-h-11 rounded-lg border border-paperLine px-3 text-sm text-blue-700">
        + เพิ่มหมวดหมู่
      </button>
      <Sheet
        open={formOpen}
        title="เพิ่มหมวดหมู่"
        onClose={cancelAdd}
        header={<FormHeader title="เพิ่มหมวดหมู่" onCancel={cancelAdd} formId="add-cash-category" saving={busy} />}
      >
        <form id="add-cash-category" onSubmit={add} className="space-y-3">
          <input
            autoFocus
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              setError("");
            }}
            placeholder="ชื่อหมวดหมู่ใหม่"
            className="w-full border border-paperLine rounded px-3 py-2 text-sm focus:border-teal"
          />
          {error && <p role="alert" className="text-sm text-rust">{error}</p>}
        </form>
      </Sheet>
    </div>
  );
}

export default function AdminFunds() {
  const { user, profile } = useAuth();
  const { confirm, toast } = useFeedback();
  const [funds, setFunds] = useState([]);
  const [topups, setTopups] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [newFund, setNewFund] = useState({ label: "", openingBalance: "" });
  const [topupDraft, setTopupDraft] = useState({}); // { [fundId]: {amount, note} }
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ label: "", openingBalance: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState("funds");
  const [topupFundId, setTopupFundId] = useState(null);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "funds"), orderBy("createdAt", "asc")), (s) =>
      setFunds(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub2 = onSnapshot(collection(db, "fundTopups"), (s) =>
      setTopups(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub3 = onSnapshot(collection(db, "transactions"), (s) =>
      setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

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
    if (!draft.amount || Number(draft.amount) <= 0) {
      setError("กรุณากรอกจำนวนเงินมากกว่า 0 บาท");
      document.getElementById("fund-topup-amount")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const topupRef = doc(collection(db, "fundTopups"));
      const after = { fundId, amount: Number(draft.amount) };
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "fund-topup-created",
        targetCollection: "fundTopups",
        targetId: topupRef.id,
        before: null,
        after,
      });
      const batch = writeBatch(db);
      batch.set(topupRef, {
        ...after,
        note: (draft.note || "").trim(),
        createdBy: user.uid,
        createdByName: profile?.name || user.email,
        createdAt: serverTimestamp(),
        auditLogId: audit.ref.id,
      });
      queueAuditEvent(batch, audit);
      await batch.commit();
      setTopupDraft((d) => ({ ...d, [fundId]: { amount: "", note: "" } }));
      setTopupFundId(null);
      toast("เติมเงินเข้างบค่าใช้จ่ายแล้ว");
    } catch (err) {
      console.error(err);
      setError("เติมเงินเข้างบค่าใช้จ่ายไม่สำเร็จ");
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
    if ((draft.amount || draft.note) && !await confirm({
      title: "ยกเลิกการเติมเงิน",
      description: "ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setTopupDraft((items) => ({ ...items, [topupFundId]: { amount: "", note: "" } }));
    setTopupFundId(null);
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

  return (
    <Layout>
      <h1 className="font-slab text-lg mb-4">งบค่าใช้จ่ายหมุนเวียน</h1>

      <div role="tablist" aria-label="จัดการงบค่าใช้จ่าย" className="mb-4 flex gap-2 overflow-x-auto">
        {[
          ["funds", "งบค่าใช้จ่าย"],
          ["create", "เพิ่มงบ"],
          ["categories", "หมวดหมู่"],
        ].map(([value, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={section === value}
            key={value}
            onClick={() => setSection(value)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${
              section === value ? "border-blue-600 bg-blue-600 text-white" : "border-paperLine bg-white text-inkSoft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "funds" && <div className="space-y-4 mb-8">
        {funds.map((f) => {
          const balance = currentFundBalance(f, topups, transactions);
          const draft = topupDraft[f.id] || { amount: "", note: "" };
          return (
            <div key={f.id} className="bg-white border border-paperLine rounded-lg p-5">
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
                      <input
                        value={editDraft.label}
                        onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                        className="w-full border border-paperLine rounded px-3 py-2 text-sm focus:border-teal"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-inkSoft block mb-1">ยอดเงินตั้งต้น (บาท)</label>
                      <input
                        id="fund-topup-amount"
                        type="number"
                        step="0.01"
                        value={editDraft.openingBalance}
                        onChange={(e) => setEditDraft((d) => ({ ...d, openingBalance: e.target.value }))}
                        className="w-full border border-paperLine rounded px-3 py-2 text-sm font-nums focus:border-teal"
                      />
                    </div>
                  </div>
                  {error && <p className="text-sm text-rust mb-2">{error}</p>}
                </div>
              ) : (
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-slab text-lg">{f.label}</div>
                      <button
                        onClick={() => startEdit(f)}
                        className="text-inkSoft hover:text-teal p-1 -m-1"
                        title="แก้ไขฝั่งนี้"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-inkSoft">
                      ยอดตั้งต้น {formatBaht(f.openingBalance)} บาท
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-inkSoft">ยอดคงเหลือปัจจุบัน</div>
                    <div className="font-nums text-2xl text-teal">{formatBaht(balance)}</div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setTopupFundId(f.id)}
                className="mt-3 min-h-11 w-full rounded-lg border border-paperLine text-sm font-medium text-blue-700"
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
                        {formatDateTime(t.createdAt)} {t.note && `(${t.note})`}
                      </li>
                    ))}
                </ul>
              </details>
            </div>
          );
        })}
      </div>}

      {section === "create" && <div className="bg-white border border-paperLine rounded-lg p-5 max-w-md">
        <h2 className="font-slab text-base mb-3">เพิ่มฝั่งเงินหมุนเวียนใหม่</h2>
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
            <input
                    id="new-fund-label"
                    value={newFund.label}
              onChange={(e) => setNewFund((f) => ({ ...f, label: e.target.value }))}
              placeholder="เช่น หน้าร้าน"
              className="w-full border border-paperLine rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">ยอดเงินตั้งต้น (บาท)</label>
            <input
              id="new-fund-opening"
              type="number"
              step="0.01"
              value={newFund.openingBalance}
              onChange={(e) => setNewFund((f) => ({ ...f, openingBalance: e.target.value }))}
              placeholder="เช่น 30000"
              className="w-full border border-paperLine rounded px-3 py-2 font-nums"
            />
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
        </form>
      </div>}

      {section === "categories" && <CashCategoryManager />}
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
          }} className="space-y-3">
            <label className="block text-sm">
              จำนวนเงิน (บาท)
              <input
                type="number"
                step="0.01"
                value={(topupDraft[topupFundId] || {}).amount || ""}
                onChange={(event) => setTopupDraft((items) => ({
                  ...items,
                  [topupFundId]: { ...(items[topupFundId] || {}), amount: event.target.value },
                }))}
                className="mt-1 w-full border border-paperLine rounded px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              หมายเหตุ
              <input
                value={(topupDraft[topupFundId] || {}).note || ""}
                onChange={(event) => setTopupDraft((items) => ({
                  ...items,
                  [topupFundId]: { ...(items[topupFundId] || {}), note: event.target.value },
                }))}
                className="mt-1 w-full border border-paperLine rounded px-3 py-2"
              />
            </label>
            {error && <p role="alert" className="text-sm text-rust">{error}</p>}
          </form>
        )}
      </Sheet>
    </Layout>
  );
}
