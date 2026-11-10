import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({ open, title, onClose, children, footer }) {
  const token = `modal-${useId()}`;
  const touchStartY = useRef(null);
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);
  const historyAdded = useRef(false);
  onCloseRef.current = onClose;
  openRef.current = open;

  useEffect(() => {
    if (!open) {
      historyAdded.current = false;
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (window.history.state?.__uiOverlay !== token) {
      window.history.pushState({ ...(window.history.state || {}), __uiOverlay: token }, "");
    }
    historyAdded.current = true;
    function onKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current();
    }
    function onPopState(event) {
      if (event.state?.__uiOverlay === token) return;
      onCloseRef.current();
      window.setTimeout(() => {
        if (openRef.current && window.history.state?.__uiOverlay !== token) {
          window.history.pushState({ ...(window.history.state || {}), __uiOverlay: token }, "");
        }
      }, 0);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [open, token]);

  useEffect(() => {
    if (open) return;
    if (historyAdded.current && window.history.state?.__uiOverlay === token) {
      window.history.back();
    }
    historyAdded.current = false;
  }, [open, token]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-paperLine bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
        onTouchStart={(event) => {
          touchStartY.current = event.target.closest?.("[data-sheet-handle]")
            ? event.touches[0].clientY
            : null;
        }}
        onTouchEnd={(event) => {
          if (touchStartY.current !== null && event.changedTouches[0].clientY - touchStartY.current > 90) {
            onClose();
          }
          touchStartY.current = null;
        }}
      >
        <div className="shrink-0 border-b border-paperLine bg-white px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-4">
          <div data-sheet-handle className="mb-2 flex h-2 items-center justify-center sm:hidden">
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
            <button type="button" aria-label="ปิดหน้าต่าง" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-inkSoft hover:bg-blue-50">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-paperLine bg-white px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">{footer}</div>}
      </section>
    </div>
  );
}
