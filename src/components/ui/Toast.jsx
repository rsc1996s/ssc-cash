import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

export default function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div role="status" className="fixed left-4 right-4 top-4 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-green-800 shadow-lg sm:left-auto sm:right-6">
      <CheckCircle2 size={20} className="shrink-0 text-green-600" />
      <span className="flex-1">{message}</span>
      <button type="button" aria-label="ปิดการแจ้งเตือน" onClick={onClose} className="rounded-full p-1 text-inkSoft hover:bg-blue-50">
        <X size={18} />
      </button>
    </div>
  );
}
