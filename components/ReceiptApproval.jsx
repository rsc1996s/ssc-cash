import { useState } from "react";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { newAuditEvent, queueAuditEvent } from "../lib/audit";
import { dashboardTransactionDate } from "../lib/dashboardCash";
import { sumSatang } from "../lib/money";
import { formatBaht } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "./ui/FeedbackProvider";
import Button from "./ui/Button";
import Sheet from "./ui/Sheet";
import SignaturePad from "./SignaturePad";

const APPROVAL_CHUNK_SIZE = 5;

export default function ReceiptApproval({ rows }) {
  const { user, profile } = useAuth();
  const { confirm } = useFeedback();
  const [selected, setSelected] = useState([]);
  const [signOpen, setSignOpen] = useState(false);
  const [signature, setSignature] = useState(null);
  const [approvalTargets, setApprovalTargets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const pending = rows.filter((row) => row.status === "pending");
  const chosen = pending.filter((row) => selected.includes(row.id));

  async function begin() {
    if (!chosen.length) return;
    let total;
    try { total = sumSatang(chosen.map((row) => row.amount)); }
    catch (err) { setError(err.message); return; }
    if (!await confirm({
      title: "ยืนยันอนุมัติรับโอน",
      description: `อนุมัติ ${chosen.length} รายการ รวม ${formatBaht(total / 100)} บาท กรุณาลงลายเซ็นเพื่อดำเนินการ`,
      confirmLabel: "ลงลายเซ็น", cancelLabel: "กลับไปตรวจสอบ",
    })) return;
    setResult(null);
    setSignature(null);
    setError("");
    setApprovalTargets(chosen);
    setSignOpen(true);
  }

  async function approve(targets) {
    if (!signature || busy) return;
    setBusy(true);
    setError("");
    const outcome = { approved: [], skipped: [], failed: [] };
    setProgress({ done: 0, total: targets.length });
    for (let offset = 0; offset < targets.length; offset += APPROVAL_CHUNK_SIZE) {
      const chunk = targets.slice(offset, offset + APPROVAL_CHUNK_SIZE);
      try {
        const audits = chunk.map((row) => newAuditEvent({
          actorUid: user.uid, actorName: profile?.name || user.email,
          action: "transaction-status-changed", targetCollection: "transactions", targetId: row.id,
          before: { status: "pending" }, after: { status: "approved" },
        }));
        const resultChunk = await runTransaction(db, async (batch) => {
          const snapshots = await Promise.all(chunk.map((row) => batch.get(doc(db, "transactions", row.id))));
          const approved = [];
          const skipped = [];
          snapshots.forEach((snapshot, index) => {
            const original = chunk[index];
            const current = snapshot.exists() ? snapshot.data() : null;
            if (!current || current.status !== "pending" || current.fundId !== original.fundId ||
              current.type !== "income" || current.paymentMethod !== "transfer" ||
              dashboardTransactionDate(current) !== dashboardTransactionDate(original) ||
              Number(current.amount) !== Number(original.amount) ||
              current.itemDescription !== original.itemDescription || current.note !== original.note) {
              skipped.push(original.id);
              return;
            }
            const audit = audits[index];
            batch.update(snapshot.ref, {
              status: "approved", reviewedBy: user.uid, reviewedByName: profile?.name || user.email,
              reviewedAt: serverTimestamp(), reviewNote: null, approvalSignatureURL: signature,
              updatedAt: serverTimestamp(), auditLogId: audit.ref.id,
            });
            queueAuditEvent(batch, audit);
            approved.push(original.id);
          });
          return { approved, skipped };
        });
        outcome.approved.push(...resultChunk.approved);
        outcome.skipped.push(...resultChunk.skipped);
      } catch (err) {
        console.error("อนุมัติรับโอนเป็นชุดไม่สำเร็จ:", err);
        outcome.failed.push(...chunk);
      }
      setProgress({ done: Math.min(offset + chunk.length, targets.length), total: targets.length });
    }
    setResult(outcome);
    setSelected(outcome.failed.map((row) => row.id));
    setBusy(false);
  }

  return <section className="mb-4 rounded-xl border border-paperLine bg-white p-4">
    <h2 className="text-base font-semibold">รอตรวจ · งบและวันที่เลือก</h2>
    {!pending.length ? <p className="mt-2 text-sm text-inkSoft">ไม่มีรายการรอตรวจ</p> : <>
      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={pending.length > 0 && chosen.length === pending.length}
          onChange={(event) => setSelected(event.target.checked ? pending.map((row) => row.id) : [])} />
        เลือกทั้งหมด ({pending.length})
      </label>
      <div className="max-h-64 space-y-1 overflow-y-auto">{pending.map((row) =>
        <label key={row.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-paperLine p-2 text-sm">
          <input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) =>
            event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} />
          <span className="min-w-0 flex-1 break-words">{row.itemDescription}</span>
          <span className="shrink-0 font-nums">{formatBaht(row.amount)} บาท</span>
        </label>)}</div>
      <Button className="mt-3" disabled={!chosen.length} onClick={begin}>อนุมัติ {chosen.length} รายการ</Button>
    </>}
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    <Sheet open={signOpen} title="อนุมัติรับโอน" onClose={() => { if (!busy) setSignOpen(false); }}>
      {!result && <><p className="mb-2 text-sm">ลงลายเซ็นหนึ่งครั้งสำหรับรายการที่เลือก</p>
        <SignaturePad onChange={setSignature} />
        <Button className="mt-4" disabled={!signature || busy} onClick={() => approve(approvalTargets)}>ยืนยันอนุมัติ</Button></>}
      {progress && <p role="status" className="mt-3 text-sm">ดำเนินการ {progress.done}/{progress.total}</p>}
      {result && <div className="mt-3 space-y-3 text-sm">
        <p>สำเร็จ {result.approved.length} · ข้าม {result.skipped.length} · ไม่สำเร็จ {result.failed.length} รายการ</p>
        {result.skipped.length > 0 && <p>รายการที่เปลี่ยนสถานะหรือรายละเอียดแล้วถูกข้าม กรุณาตรวจสอบอีกครั้ง</p>}
        {result.failed.length > 0 && <><p role="alert">บางชุดไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่เฉพาะรายการที่ไม่สำเร็จ</p>
          <Button disabled={busy} onClick={() => approve(result.failed)}>ลองใหม่รายการที่ไม่สำเร็จ</Button></>}
        <Button variant="secondary" disabled={busy} onClick={() => setSignOpen(false)}>ปิด</Button>
      </div>}
    </Sheet>
  </section>;
}
