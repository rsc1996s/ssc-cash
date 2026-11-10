import Button from "./Button";

export default function FormHeader({
  title,
  onCancel,
  onSave,
  saving = false,
  savingLabel = "กำลังบันทึก...",
  saveLabel = "บันทึก",
  cancelLabel = "ยกเลิก",
  saveDisabled = false,
  formId,
}) {
  return (
    <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-4 flex min-h-16 items-center gap-2 border-b border-paperLine bg-white/95 px-4 py-2 shadow-sm backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:rounded-xl lg:border lg:px-4">
      <Button variant="secondary" onClick={onCancel} className="min-h-11 shrink-0 px-3">
        {cancelLabel}
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold sm:text-lg">{title}</h1>
      <Button
        type="button"
        onClick={formId ? () => document.getElementById(formId)?.requestSubmit() : onSave}
        disabled={saving || saveDisabled}
        className="min-h-11 shrink-0 px-3 sm:px-4"
      >
        {saving ? savingLabel : saveLabel}
      </Button>
    </header>
  );
}
