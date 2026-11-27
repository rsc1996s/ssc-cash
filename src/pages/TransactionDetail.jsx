import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import StatusBadge from "../components/ui/StatusBadge";
import SignaturePad from "../components/SignaturePad";
import { formatBaht, formatDate, formatDateTime, TYPE_LABEL, PAYMENT_LABEL } from "../lib/format";
import { newAuditEvent, queueAuditEvent } from "../lib/audit";
import FormHeader from "../components/ui/FormHeader";
import Sheet from "../components/ui/Sheet";
import { useFeedback } from "../components/ui/FeedbackProvider";
import SegmentedTabs from "../components/ui/SegmentedTabs";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import SearchPicker from "../components/ui/SearchPicker";
import ReceiptPhotoFields from "../components/ReceiptPhotoFields";
import useReceiptPhotos from "../components/useReceiptPhotos";
import { canRequestEvidence, canSubmitEvidence, evidencePhotos, evidenceSizeValid } from "../lib/evidence";
import { canViewFund } from "../lib/fundAccess";
import VoidReasonSheet from "../components/VoidReasonSheet";
import Loading from "../components/ui/Loading";

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
  const { user, isOwner, isStaff, profile } = useAuth();
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const [tx, setTx] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [reason, setReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSignFlow, setShowSignFlow] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [detailTab, setDetailTab] = useState("details");
  const [requestOpen, setRequestOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [requestType, setRequestType] = useState("ขอสลิป/ใบเสร็จ");
  const [requestText, setRequestText] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const receipt = useReceiptPhotos();
  const accessKey = JSON.stringify([profile?.role, profile?.disabled, profile && Object.hasOwn(profile, "fundIds"), profile?.fundIds]);

  useEffect(() => {
    setTx(null);
    setLoadError("");
    const unsub = onSnapshot(doc(db, "transactions", id), (snap) => {
      if (snap.exists()) {
        setTx({ id: snap.id, ...snap.data() });
        setLoadError("");
      }
      else setLoadError("ไม่พบรายการนี้");
    }, (loadError) => {
      console.error("โหลดรายละเอียดรายการไม่สำเร็จ:", loadError);
      setTx(null);
      setLoadError("ไม่สามารถดูรายการนี้ได้ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
    });
    return () => unsub();
  }, [id, accessKey]);

  if (loadError || (tx && !canViewFund(profile, tx.fundId))) {
    return <Layout><p role="alert" className="text-sm text-danger">{loadError || "คุณไม่ได้รับมอบหมายงบของรายการนี้"}</p></Layout>;
  }

  if (!tx || tx.id !== id) {
    return (
      <Layout>
        <Loading label="กำลังโหลดรายละเอียดรายการ" />
      </Layout>
    );
  }

  const canEdit = tx.status !== "voided" && (isOwner || (tx.createdBy === user.uid && tx.status === "pending"));
  const photos = evidencePhotos(tx);

  async function evidenceTransition(action, updates, message) {
    setBusy(true);
    setEvidenceError("");
    setError("");
    try {
      const status = action === "transaction-evidence-requested" ? "needs_evidence" : "pending";
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action,
        targetCollection: "transactions",
        targetId: id,
        before: { status: tx.status },
        after: { status },
      });
      const batch = writeBatch(db);
      batch.update(doc(db, "transactions", id), {
        ...updates, status, updatedAt: serverTimestamp(), auditLogId: audit.ref.id,
      });
      queueAuditEvent(batch, audit);
      await batch.commit();
      setRequestOpen(false);
      setSubmitOpen(false);
      setRequestText("");
      receipt.resetPhotos();
      toast(message);
    } catch (err) {
      console.error("บันทึกสถานะหลักฐานไม่สำเร็จ:", err);
      setEvidenceError("บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่");
      setError("บันทึกสถานะหลักฐานไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  function requestEvidence() {
    const text = requestText.trim();
    const note = `${requestType}: ${text}`;
    if (!text || note.length > 2000) {
      setEvidenceError("กรุณาระบุข้อความคำขอ โดยมีความยาวรวมไม่เกิน 2,000 ตัวอักษร");
      document.getElementById("evidence-request-note")?.focus();
      return;
    }
    return evidenceTransition("transaction-evidence-requested", {
      evidenceRequestedBy: user.uid,
      evidenceRequestedByName: profile?.name || user.email || "",
      evidenceRequestedAt: serverTimestamp(),
      evidenceRequestNote: note,
    }, "ส่งคำขอหลักฐานแล้ว");
  }

  function submitEvidence() {
    const urls = receipt.photos.map((photo) => photo.dataUrl);
    if (!urls.length) {
      setEvidenceError("กรุณาแนบหลักฐานอย่างน้อย 1 รูป");
      return;
    }
    if (!evidenceSizeValid(urls, tx.changePhotoURL, tx.approvalSignatureURL)) {
      setEvidenceError("รูปมีขนาดรวมเกินกำหนด กรุณาลดจำนวนหรือขนาดรูป");
      return;
    }
    return evidenceTransition("transaction-evidence-submitted", {
      receiptPhotoURL: urls[0], receiptPhotoURLs: urls, evidenceSubmittedAt: serverTimestamp(),
    }, "ส่งหลักฐานแล้ว รอผู้ตรวจสอบพิจารณา");
  }

  async function cancelEvidenceRequest() {
    if (!await confirm({ title: "ไม่ต้องใช้หลักฐานแล้ว", description: "รายการจะกลับไปรอตรวจสอบ", confirmLabel: "ยืนยัน" })) return;
    await evidenceTransition("transaction-evidence-request-cancelled", {}, "ยกเลิกคำขอหลักฐานแล้ว");
  }

  async function closeEvidenceSheet() {
    if (busy || receipt.compressing) return;
    if ((receipt.photos.length || requestText.trim()) && !await confirm({
      title: "ยกเลิกการดำเนินการ", description: "ข้อมูลที่ยังไม่ได้ส่งจะหายไป",
      confirmLabel: "ทิ้งข้อมูล", cancelLabel: "ทำต่อ", danger: true,
    })) return;
    setRequestOpen(false);
    setSubmitOpen(false);
    setRequestText("");
    setEvidenceError("");
    receipt.resetPhotos();
  }

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

  async function voidTransaction(reasonText) {
    const audit = newAuditEvent({
      actorUid: user.uid,
      actorName: profile?.name || user.email,
      action: "transaction-voided",
      targetCollection: "transactions",
      targetId: id,
      before: { status: tx.status },
      after: { status: "voided", reason: reasonText },
    });
    const batch = writeBatch(db);
    batch.update(doc(db, "transactions", id), {
      status: "voided",
      voidedBy: user.uid,
      voidedByName: profile?.name || user.email,
      voidedAt: serverTimestamp(),
      voidReason: reasonText,
      updatedAt: serverTimestamp(),
      auditLogId: audit.ref.id,
    });
    queueAuditEvent(batch, audit);
    await batch.commit();
    toast("ยกเลิกรายการแล้ว");
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

      <SegmentedTabs
        value={detailTab}
        onChange={setDetailTab}
        ariaLabel="รายละเอียดรายการ"
        className="mb-4"
        options={[
          { value: "details", label: "รายละเอียด" },
          { value: "history", label: "ประวัติการแก้ไข" },
        ]}
      />

      {detailTab === "details" && <div className="bg-white border border-paperLine rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs text-inkSoft mb-1">
              {tx.fundLabel} · {TYPE_LABEL[tx.type]} · {PAYMENT_LABEL[tx.paymentMethod]} · โดย {tx.createdByName}
            </div>
            <h1 className="text-xl font-semibold">{tx.itemDescription}</h1>
          </div>
          <StatusBadge status={tx.status} />
        </div>

        {isOwner && photos.length === 0 && (
          <p className="mb-4 rounded-lg bg-warning-light p-3 text-sm font-semibold text-warning">ไม่มีหลักฐานแนบ</p>
        )}
        {tx.evidenceRequestNote && (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning-light p-3 text-sm text-warning">
            <p className="font-semibold">{tx.status === "needs_evidence" ? "ผู้ตรวจสอบขอหลักฐาน" : "คำขอหลักฐานล่าสุด"}</p>
            <p className="break-words">{tx.evidenceRequestNote}</p>
            <p>ขอเมื่อ {formatDateTime(tx.evidenceRequestedAt)} โดย {tx.evidenceRequestedByName || "-"}</p>
            {tx.evidenceSubmittedAt && tx.status !== "needs_evidence" && <p>ส่งหลักฐานเมื่อ {formatDateTime(tx.evidenceSubmittedAt)}</p>}
            {canSubmitEvidence(tx, user.uid, isOwner || isStaff) && (
              <button type="button" onClick={() => { setEvidenceError(""); setSubmitOpen(true); }} className="mt-3 min-h-11 rounded-lg bg-primary px-4 font-semibold text-white">แนบหลักฐาน</button>
            )}
          </div>
        )}

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
            <dt className="text-inkSoft">วันที่ทำรายการ</dt>
            <dd className="text-right">
              {tx.transactionDate
                ? formatDate(new Date(`${tx.transactionDate}T00:00:00`))
                : formatDate(tx.createdAt)}
            </dd>
            <dt className="text-inkSoft">เวลาบันทึก (ระบบ)</dt>
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
            {tx.voidReason && (
              <>
                <dt className="text-inkSoft">เหตุผลที่ยกเลิก</dt>
                <dd className="text-right">{tx.voidReason} · {tx.voidedByName} ({formatDateTime(tx.voidedAt)})</dd>
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
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  step={f.type === "number" ? "0.01" : undefined}
                  value={draft[f.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="w-full border border-paperLine rounded px-3 py-2 focus:border-primary"
                />
              </div>
            ))}
            <div>
              <label className="text-sm text-inkSoft block mb-1">
                เหตุผลในการแก้ไข <span className="text-danger">*จำเป็น</span>
              </label>
              <Textarea
                id="transaction-edit-reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full border border-paperLine rounded px-3 py-2 focus:border-primary"
                placeholder="เช่น พิมพ์จำนวนเงินผิด แก้จาก 150 เป็น 250"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
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

        {isOwner && ["pending", "needs_evidence"].includes(tx.status) && !editing && (
          <div className="mt-5 pt-5 border-t border-paperLine">
            <label className="text-sm text-inkSoft block mb-1">หมายเหตุการตรวจสอบ (ถ้ามี)</label>
            <Textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              className="w-full border border-paperLine rounded px-3 py-2 mb-3 focus:border-primary"
            />

            <p className="text-sm text-inkSoft mb-2">
              การอนุมัติจะถือว่า "เบิกสำเร็จ" ก็ต่อเมื่อมีลายเซ็นออนไลน์เท่านั้น
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowSignFlow(true)}
                disabled={busy || tx.status !== "pending"}
                className="bg-primary text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                อนุมัติ (เซ็นยืนยัน)
              </button>
              {canRequestEvidence(tx, user.uid, isOwner) && (
                <button type="button" onClick={() => { setEvidenceError(""); setRequestOpen(true); }} disabled={busy} className="rounded border border-warning px-4 py-2 text-sm text-warning">ขอหลักฐาน</button>
              )}
              {tx.status === "needs_evidence" && (
                <button type="button" onClick={cancelEvidenceRequest} disabled={busy} className="rounded border border-paperLine px-4 py-2 text-sm">ไม่ต้องใช้หลักฐานแล้ว</button>
              )}
              <button
                onClick={() => review("rejected")}
                disabled={busy}
                className="bg-danger text-white rounded px-4 py-2 text-sm font-medium"
              >
                ตีกลับ
              </button>
            </div>
            {tx.status === "needs_evidence" && <p className="mt-2 text-sm text-warning">อนุมัติไม่ได้ระหว่างรอหลักฐาน กรุณารอผู้สร้างส่งหลักฐานหรือยกเลิกคำขอ</p>}
          </div>
        )}
        {isOwner && tx.status !== "voided" && !editing && (
          <button type="button" onClick={() => setVoidOpen(true)} className="mt-4 min-h-11 rounded-lg border border-danger px-4 text-sm font-medium text-danger">
            ยกเลิกรายการ
          </button>
        )}
        {!editing && error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

        {(tx.status === "approved" || (tx.status === "voided" && tx.approvalSignatureURL)) && (
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
              {tx.status === "approved" && <Link
                to={`/transaction/${tx.id}/print`}
                className="text-sm bg-blue-600 text-white rounded px-4 py-2 font-medium"
              >
                พิมพ์ใบเบิก
              </Link>}
            </div>
          </div>
        )}
      </div>}

      {detailTab === "history" && (
        <div className="bg-white border border-paperLine rounded-lg p-6">
          <h2 className="text-base font-semibold mb-3">ประวัติการแก้ไข (Audit Trail)</h2>
          {(!tx.editHistory || tx.editHistory.length === 0) && (
            <p className="text-sm text-inkSoft">ยังไม่มีการแก้ไขรายการนี้</p>
          )}
          <ul className="space-y-3">
            {(tx.editHistory || [])
              .slice()
              .reverse()
              .map((h, i) => (
                <li key={i} className="text-sm border-l-2 border-warning pl-3">
                  <div className="font-medium">
                    {h.editedByName} · {formatDateTime(h.editedAt)}
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

      <VoidReasonSheet
        open={voidOpen}
        title="ยกเลิกรายการ"
        description="รายการจะถูกเก็บไว้ในประวัติ แต่ไม่นับในยอดงบและรายงานอีก ยอดย้อนหลังอาจเปลี่ยน"
        onClose={() => setVoidOpen(false)}
        onConfirm={voidTransaction}
      />

      <Sheet
        open={requestOpen}
        title="ขอหลักฐาน"
        onClose={closeEvidenceSheet}
        header={<FormHeader title="ขอหลักฐาน" onCancel={closeEvidenceSheet} onSave={requestEvidence} saving={busy} saveLabel="ส่งคำขอ" />}
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium">ประเภทหลักฐาน
            <SearchPicker value={requestType} onChange={setRequestType} ariaLabel="ประเภทหลักฐาน" options={[
              { value: "ขอสลิป/ใบเสร็จ", label: "ขอสลิป/ใบเสร็จ" },
              { value: "ขอรูปสินค้า/งาน", label: "ขอรูปสินค้า/งาน" },
              { value: "อื่น ๆ", label: "อื่น ๆ" },
            ]} />
          </label>
          <label htmlFor="evidence-request-note" className="block text-sm font-medium">ข้อความคำขอ (จำเป็น)</label>
          <Textarea id="evidence-request-note" value={requestText} maxLength={1980} onChange={(event) => setRequestText(event.target.value)} />
          {evidenceError && <p role="alert" className="text-sm text-danger">{evidenceError}</p>}
        </div>
      </Sheet>
      <Sheet
        open={submitOpen}
        title="แนบหลักฐาน"
        onClose={closeEvidenceSheet}
        header={<FormHeader title="แนบหลักฐาน" onCancel={closeEvidenceSheet} onSave={submitEvidence} saving={busy || receipt.compressing} saveLabel="ส่งหลักฐาน" />}
      >
        <p className="mb-3 text-sm text-inkSoft">แนบรูป 1–3 รูป แล้วส่งกลับให้ผู้ตรวจสอบ</p>
        <ReceiptPhotoFields {...receipt} />
        {evidenceError && <p role="alert" className="mt-3 text-sm text-danger">{evidenceError}</p>}
      </Sheet>
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
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </Sheet>
    </Layout>
  );
}
