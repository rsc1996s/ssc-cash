import Button from "./Button";
import Modal from "./Modal";

export default function ConfirmDialog({
  open,
  title = "ยืนยันการทำรายการ",
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-base leading-relaxed text-inkSoft">{description}</p>
    </Modal>
  );
}
