import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const openSheets = new Set();
let originalOverflow = "";
let cleanupTimer;

function cleanClosedHistoryEntries() {
  window.clearTimeout(cleanupTimer);
  cleanupTimer = window.setTimeout(() => {
    const stack = window.history.state?.__uiOverlayStack || [];
    let count = 0;
    for (let index = stack.length - 1; index >= 0 && !openSheets.has(stack[index]); index -= 1) count += 1;
    if (count) window.history.go(-count);
  }, 0);
}

export default function Sheet({ open, title, onClose, children, footer, header, panelClassName = "" }) {
  const touchStartY = useRef(null);
  const token = `sheet-${useId()}`;
  const onCloseRef = useRef(onClose);
  const historyAdded = useRef(false);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    if (openSheets.size === 0) originalOverflow = document.body.style.overflow;
    openSheets.add(token);
    document.body.style.overflow = "hidden";
    if (window.history.state?.__uiOverlay !== token) {
      const state = window.history.state || {};
      window.history.pushState({ ...state, __uiOverlay: token, __uiOverlayStack: [...(state.__uiOverlayStack || []), token] }, "");
    }
    historyAdded.current = true;
    function onKeyDown(event) {
      if (event.key === "Escape" && window.history.state?.__uiOverlay === token) requestClose();
    }
    function onPopState(event) {
      if (event.state?.__uiOverlayStack?.includes(token)) return;
      if ([...openSheets].at(-1) !== token) return;
      const state = event.state || {};
      window.history.pushState({ ...state, __uiOverlay: token, __uiOverlayStack: [...(state.__uiOverlayStack || []), token] }, "");
      onCloseRef.current();
    }
    function requestClose() {
      if (historyAdded.current && window.history.state?.__uiOverlay === token) {
        window.history.back();
      } else {
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      openSheets.delete(token);
      if (openSheets.size === 0) document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
      cleanClosedHistoryEntries();
    };
  }, [open, token]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSheet();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={header ? undefined : `${token}-title`}
        aria-label={header ? title : undefined}
        className={`flex w-full flex-col overflow-hidden rounded-t-2xl border border-paperLine bg-white shadow-xl sm:rounded-2xl ${panelClassName || "max-h-[85dvh] sm:max-w-xl"}`}
        onTouchStart={(event) => {
          touchStartY.current = event.target.closest?.("[data-sheet-handle]")
            ? event.touches[0].clientY
            : null;
        }}
        onTouchEnd={(event) => {
          if (touchStartY.current !== null && event.changedTouches[0].clientY - touchStartY.current > 90) {
            closeSheet();
          }
          touchStartY.current = null;
        }}
      >
        <div className="shrink-0 pt-[env(safe-area-inset-top)]">
          <div data-sheet-handle className="flex h-4 items-center justify-center sm:hidden">
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>
          {header || (
            <div className="border-b border-paperLine bg-white px-4 pb-3 pt-1 sm:pt-4">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <h2 id={`${token}-title`} className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
                <button type="button" aria-label="ปิด" onClick={closeSheet} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-inkSoft hover:bg-blue-50">
                  <X size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-paperLine bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </section>
    </div>,
    document.body
  );

  function closeSheet() {
    if (historyAdded.current && window.history.state?.__uiOverlay === token) {
      window.history.back();
    } else {
      onClose();
    }
  }
}
