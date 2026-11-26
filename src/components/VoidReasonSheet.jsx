import { useState } from "react";
import { useFeedback } from "./ui/FeedbackProvider";
import FormHeader from "./ui/FormHeader";
import Sheet from "./ui/Sheet";
import Textarea from "./ui/Textarea";

export default function VoidReasonSheet({ open, title, description, onClose, onConfirm }) {
  const { confirm } = useFeedback();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function close() {
    if (busy) return;
    if (reason.trim() && !await confirm({
      title: "ทิ้งเหตุผลที่กรอกไว้", description: "ข้อมูลที่ยังไม่บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล", cancelLabel: "ทำต่อ", danger: true,
    })) return;
    setReason("");
    setError("");
    onClose();
  }

  async function submit(event) {
    event.preventDefault();
    const text = reason.trim();
    if (!text || text.length > 1000) {
      setError("กรุณาระบุเหตุผลไม่เกิน 1,000 ตัวอักษร");
      document.getElementById("void-reason")?.focus();
      return;
    }
    if (!await confirm({
      title, description, confirmLabel: "ยืนยัน", cancelLabel: "กลับ", danger: true,
    })) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(text);
      setReason("");
      onClose();
    } catch (err) {
      console.error("ดำเนินการไม่สำเร็จ:", err);
      if (err.code === "permission-denied") {
        setError("ไม่มีสิทธิ์ดำเนินการ หรือกฎความปลอดภัยยังไม่รองรับ กรุณาตรวจสอบสิทธิ์และการอัปเดตระบบ");
      } else if (err.code === "unavailable") {
        setError("เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่");
      } else {
        setError(err.message || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} title={title} onClose={close}
      header={<FormHeader title={title} onCancel={close} formId="void-reason-form" saving={busy} saveLabel="ดำเนินการ" />}>
      <form id="void-reason-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-inkSoft">{description}</p>
        <label htmlFor="void-reason" className="block text-sm font-medium">เหตุผล (จำเป็น)</label>
        <Textarea id="void-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </Sheet>
  );
}
