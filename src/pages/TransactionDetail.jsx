import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import SignaturePad from "../components/SignaturePad";
import { formatBaht, formatDateTime, TYPE_LABEL, PAYMENT_LABEL } from "../lib/format";
import { newAuditEvent, queueAuditEvent } from "../lib/audit";
import FormHeader from "../components/ui/FormHeader";
import Sheet from "../components/ui/Sheet";
import { useFeedback } from "../components/ui/FeedbackProvider";

const EDITABLE_FIELDS = [
  { key: "amount", label: "จำนวนเงิน", type: "number" },
  { key: "withdrawnAmount", label: "เบิกเงินไป", type: "number" },
  { key: "itemDescription", label: "รายละเอียด", type: "text" },
  { key: "changeAmount", label: "เงินทอน", type: "number" },
  { key: "paymentMethod", label: "ช่องทางชำระ", type: "text" },
  { key: "note", label: "หมายเหตุ", type: "text" },
];

export default function TransactionDetail() {
  const { id } = useParams();
  const { user, isOwner, profile } = useAuth();
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const [tx, setTx] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [reason, setReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSignFlow, setShowSignFlow] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [detailTab, setDetailTab] = useState("details");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "transactions", id), (snap) => {
      if (snap.exists()) setTx({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [id]);

  if (!tx) {
    return (
      <Layout>
        <p className="text-sm text-inkSoft">กำลังโหลด...</p>
      </Layout>
    );
  }

  const canEdit = isOwner || (tx.createdBy === user.uid && tx.status === "pending");

  function startEdit() {
    setDraft({
      amount: tx.amount,
      withdrawnAmount: tx.withdrawnAmount ?? "",
      itemDescription: tx.itemDescription,
      changeAmount: tx.changeAmount ?? "",
      paymentMethod: tx.paymentMethod,
      note: tx.note ?? "",
    });
    setReason("");
    setError("");
    setEditing(true);
  }

  async function cancelEdit() {
    const changed = Object.keys(draft).some((key) => String(draft[key] ?? "") !== String(tx[key] ?? ""));
    if (changed || reason.trim()) {
      if (!await confirm({
        title: "ยกเลิกการแก้ไข",
        description: "ข้อมูลที่แก้ไขแต่ยังไม่บันทึกจะหายไป",
        confirmLabel: "ยกเลิกการแก้ไข",
        danger: true,
      })) return;
    }
    setEditing(false);
    setError("");
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("กรุณาระบุเหตุผลในการแก้ไข (บันทึกลงประวัติถาวร)");
      document.getElementById("transaction-edit-reason")?.focus();
      return;
    }

    const changes = {};
    for (const f of EDITABLE_FIELDS) {
      const oldVal = tx[f.key] ?? "";
      const newVal = f.type === "number" ? Number(draft[f.key] || 0) : draft[f.key];
      if (String(oldVal) !== String(newVal)) {
        changes[f.key] = { before: oldVal, after: newVal };
      }
    }

    if (Object.keys(changes).length === 0) {
      setError("ไม่มีข้อมูลที่เปลี่ยนแปลง");
      return;
    }

    setBusy(true);
    try {
      const updates = {};
      for (const key of Object.keys(changes)) {
        const f = EDITABLE_FIELDS.find((x) => x.key === key);
        updates[key] = f.type === "number" ? Number(draft[key] || 0) : draft[key];
      }
      updates.updatedAt = serverTimestamp();
      updates.editHistory = arrayUnion({
        editedBy: user.uid,
        editedByName: profile?.name || user.email,
        editedAt: new Date().toISOString(),
        reason: reason.trim(),
        changes,
      });

      await updateDoc(doc(db, "transactions", id), updates);
      setEditing(false);
      toast("บันทึกการแก้ไขแล้ว");
    } catch (err) {
      console.error(err);
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function review(status) {
    const confirmed = await confirm({
      title: status === "rejected" ? "ตีกลับรายการ" : "ยกเลิกรายการ",
      description: status === "rejected"
        ? "ยืนยันตีกลับรายการนี้หรือไม่"
        : "ยืนยันยกเลิกรายการนี้หรือไม่",
      confirmLabel: status === "rejected" ? "ตีกลับ" : "ยกเลิกรายการ",
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "transaction-status-changed",
        targetCollection: "transactions",
        targetId: id,
        before: { status: tx.status },
        after: { status },
      });
      const batch = writeBatch(db);
      batch.update(doc(db, "transactions", id), {
        status,
        reviewedBy: user.uid,
        reviewedByName: profile?.name || user.email,
        reviewedAt: serverTimestamp(),
        reviewNote: reviewNote.trim() || null,
        updatedAt: serverTimestamp(),
        auditLogId: audit.ref.id,
      });
      queueAuditEvent(batch, audit);
      await batch.commit();
      setReviewNote("");
      toast(status === "rejected" ? "ตีกลับรายการแล้ว" : "ยกเลิกรายการแล้ว");
    } catch (err) {
      console.error(err);
      setError("บันทึกผลการตรวจสอบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  // อนุมัติ (เบิกสำเร็จ) ต้องมีลายเซ็นออนไลน์แนบมาด้วยเสมอ — บังคับที่ทั้งหน้าเว็บและ Firestore rules
  async function approveWithSignature() {
    if (!signatureDataUrl) {
      setError("กรุณาเซ็นลายเซ็นก่อนกดยืนยันอนุมัติ");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "transaction-status-changed",
        targetCollection: "transactions",
        targetId: id,
        before: { status: tx.status },
        after: { status: "approved" },
      });
      const batch = writeBatch(db);
      batch.update(doc(db, "transactions", id), {
        status: "approved",
        reviewedBy: user.uid,
        reviewedByName: profile?.name || user.email,
        reviewedAt: serverTimestamp(),
        reviewNote: reviewNote.trim() || null,
        approvalSignatureURL: signatureDataUrl,
        updatedAt: serverTimestamp(),
        auditLogId: audit.ref.id,
      });
      queueAuditEvent(batch, audit);
      await batch.commit();
      setShowSignFlow(false);
      setSignatureDataUrl(null);
      setReviewNote("");
      toast("อนุมัติรายการแล้ว");
    } catch (err) {
      console.error(err);
      setError("อนุมัติไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <button onClick={() => navigate(-1)} className="text-sm text-inkSoft mb-4">
        ← กลับ
      </button>

      <div role="tablist" aria-label="รายละเอียดรายการ" className="mb-4 flex gap-2">
        {[
          ["details", "รายละเอียด"],
          ["history", "ประวัติการแก้ไข"],
        ].map(([value, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === value}
            key={value}
            onClick={() => setDetailTab(value)}
            className={`min-h-11 rounded-full border px-4 text-sm ${
              detailTab === value ? "border-blue-600 bg-blue-600 text-white" : "border-paperLine bg-white text-inkSoft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {detailTab === "details" && <div className="bg-white border border-paperLine rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs text-inkSoft mb-1">
              {tx.fundLabel} · {TYPE_LABEL[tx.type]} · {PAYMENT_LABEL[tx.paymentMethod]} · โดย {tx.createdByName}
            </div>
            <h1 className="font-slab text-xl">{tx.itemDescription}</h1>
          </div>
          <StatusBadge status={tx.status} />
        </div>

        {!editing ? (
          <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
            <dt className="text-inkSoft">จำนวนเงิน</dt>
            <dd className="font-nums text-right">{formatBaht(tx.amount)} บาท</dd>
            {tx.type === "expense" && (
              <>
                <dt className="text-inkSoft">เบิกเงินไป</dt>
                <dd className="font-nums text-right">{formatBaht(tx.withdrawnAmount)} บาท</dd>
                <dt className="text-inkSoft">เงินทอน</dt>
                <dd className="font-nums text-right">{formatBaht(tx.changeAmount)} บาท</dd>
              </>
            )}
            {tx.category && (
              <>
                <dt className="text-inkSoft">หมวดหมู่</dt>
                <dd className="text-right">{tx.category}</dd>
              </>
            )}
            <dt className="text-inkSoft">หมายเหตุ</dt>
            <dd className="text-right">{tx.note || "-"}</dd>
            <dt className="text-inkSoft">บันทึกเมื่อ</dt>
            <dd className="text-right">{formatDateTime(tx.createdAt)}</dd>
            {tx.reviewedAt && (
              <>
                <dt className="text-inkSoft">ตรวจสอบโดย</dt>
                <dd className="text-right">
                  {tx.reviewedByName} ({formatDateTime(tx.reviewedAt)})
                </dd>
              </>
            )}
            {tx.reviewNote && (
              <>
                <dt className="text-inkSoft">หมายเหตุการตรวจสอบ</dt>
                <dd className="text-right">{tx.reviewNote}</dd>
              </>
            )}
          </dl>
        ) : (
          <form id="edit-transaction-form" onSubmit={saveEdit} className="space-y-3 mb-4">
            <FormHeader
              title="แก้ไขรายการ"
              onCancel={cancelEdit}
              formId="edit-transaction-form"
              saving={busy}
              saveLabel="บันทึก"
            />
            {EDITABLE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-sm text-inkSoft block mb-1">{f.label}</label>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  step={f.type === "number" ? "0.01" : undefined}
                  value={draft[f.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
                />
              </div>
            ))}
            <div>
              <label className="text-sm text-inkSoft block mb-1">
                เหตุผลในการแก้ไข <span className="text-rust">*จำเป็น</span>
              </label>
              <textarea
                id="transaction-edit-reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
                placeholder="เช่น พิมพ์จำนวนเงินผิด แก้จาก 150 เป็น 250"
              />
            </div>
            {error && <p className="text-sm text-rust">{error}</p>}
          </form>
        )}

        <div className="mb-4">
          {(tx.receiptPhotoURLs?.length ? tx.receiptPhotoURLs : tx.receiptPhotoURL ? [tx.receiptPhotoURL] : [])
            .length > 0 && <div className="text-xs text-inkSoft mb-1">รูปหลักฐาน</div>}
          <div className="grid grid-cols-3 gap-3">
            {(tx.receiptPhotoURLs?.length ? tx.receiptPhotoURLs : tx.receiptPhotoURL ? [tx.receiptPhotoURL] : []).map(
              (url, i) => (
                <a href={url} target="_blank" rel="noreferrer" key={i}>
                  <img
                    src={url}
                    alt={`หลักฐาน ${i + 1}`}
                    className="rounded border border-paperLine w-full aspect-square object-cover"
                  />
                </a>
              )
            )}
            {tx.changePhotoURL && (
              <a href={tx.changePhotoURL} target="_blank" rel="noreferrer">
                <div className="text-xs text-inkSoft mb-1">เงินทอน</div>
                <img
                  src={tx.changePhotoURL}
                  alt="เงินทอน"
                  className="rounded border border-paperLine w-full aspect-square object-cover"
                />
              </a>
            )}
          </div>
        </div>

        {!editing && canEdit && (
          <button onClick={startEdit} className="text-sm border border-paperLine rounded px-4 py-2">
            แก้ไขรายการ (ต้องระบุเหตุผล)
          </button>
        )}

        {isOwner && tx.status === "pending" && !editing && (
          <div className="mt-5 pt-5 border-t border-paperLine">
            <label className="text-sm text-inkSoft block mb-1">หมายเหตุการตรวจสอบ (ถ้ามี)</label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              className="w-full border border-paperLine rounded px-3 py-2 mb-3 focus:border-teal"
            />

            <p className="text-sm text-inkSoft mb-2">
              การอนุมัติจะถือว่า "เบิกสำเร็จ" ก็ต่อเมื่อมีลายเซ็นออนไลน์เท่านั้น
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowSignFlow(true)}
                disabled={busy}
                className="bg-teal text-white rounded px-4 py-2 text-sm font-medium"
              >
                อนุมัติ (เซ็นยืนยัน)
              </button>
              <button
                onClick={() => review("rejected")}
                disabled={busy}
                className="bg-rust text-white rounded px-4 py-2 text-sm font-medium"
              >
                ตีกลับ
              </button>
              <button
                onClick={() => review("voided")}
                disabled={busy}
                className="border border-paperLine rounded px-4 py-2 text-sm"
              >
                ยกเลิกรายการ
              </button>
            </div>
          </div>
        )}

        {tx.status === "approved" && (
          <div className="mt-5 pt-5 border-t border-paperLine">
            <div className="flex justify-between items-end mb-3">
              <div>
                <div className="text-xs text-inkSoft mb-1">ลายเซ็นผู้อนุมัติ</div>
                {tx.approvalSignatureURL && (
                  <img
                    src={tx.approvalSignatureURL}
                    alt="ลายเซ็นผู้อนุมัติ"
                    className="h-16 border border-paperLine rounded bg-white"
                  />
                )}
              </div>
              <Link
                to={`/transaction/${tx.id}/print`}
                className="text-sm bg-blue-600 text-white rounded px-4 py-2 font-medium"
              >
                พิมพ์ใบเบิก
              </Link>
            </div>
          </div>
        )}
      </div>}

      {detailTab === "history" && (
        <div className="bg-white border border-paperLine rounded-lg p-6">
          <h2 className="font-slab text-base mb-3">ประวัติการแก้ไข (Audit Trail)</h2>
          {(!tx.editHistory || tx.editHistory.length === 0) && (
            <p className="text-sm text-inkSoft">ยังไม่มีการแก้ไขรายการนี้</p>
          )}
          <ul className="space-y-3">
            {(tx.editHistory || [])
              .slice()
              .reverse()
              .map((h, i) => (
                <li key={i} className="text-sm border-l-2 border-amber pl-3">
                  <div className="font-medium">
                    {h.editedByName} · {new Date(h.editedAt).toLocaleString("th-TH")}
                  </div>
                  <div className="text-inkSoft mb-1">เหตุผล: {h.reason}</div>
                  <ul className="text-xs text-inkSoft list-disc list-inside">
                    {Object.entries(h.changes || {}).map(([field, c]) => (
                      <li key={field}>
                        {field}: {String(c.before)} → {String(c.after)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </div>
      )}

      <Sheet
        open={showSignFlow}
        title="อนุมัติด้วยลายเซ็น"
        onClose={() => {
          setShowSignFlow(false);
          setSignatureDataUrl(null);
          setError("");
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowSignFlow(false);
                setSignatureDataUrl(null);
                setError("");
              }}
              className="min-h-11 rounded-lg border border-paperLine px-4 text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={approveWithSignature}
              disabled={busy || !signatureDataUrl}
              className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "กำลังบันทึก..." : "ยืนยันอนุมัติ"}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-inkSoft">ลงลายเซ็นเพื่อยืนยันการอนุมัติ รายการจะถือว่าเบิกสำเร็จหลังบันทึกแล้ว</p>
        <SignaturePad onChange={setSignatureDataUrl} />
        {error && <p role="alert" className="mt-2 text-sm text-rust">{error}</p>}
      </Sheet>
    </Layout>
  );
}
