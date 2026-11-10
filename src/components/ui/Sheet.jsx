import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export default function Sheet({ open, title, onClose, children, footer, header }) {
  const touchStartY = useRef(null);
  const token = `sheet-${useId()}`;
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  const historyAdded = useRef(false);
  const backPending = useRef(false);
  openRef.current = open;
  onCloseRef.current = onClose;

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
      if (event.key === "Escape") requestClose();
    }
    function onPopState(event) {
      if (event.state?.__uiOverlay === token) return;
      if (backPending.current) {
        backPending.current = false;
        if (openRef.current && !event.state?.__uiOverlay) {
          window.history.pushState({ ...(event.state || {}), __uiOverlay: token }, "");
        }
        return;
      }
      backPending.current = true;
      onCloseRef.current();
      window.setTimeout(() => {
        if (!openRef.current) {
          backPending.current = false;
        } else if (!window.history.state?.__uiOverlay) {
          window.history.pushState({ ...(window.history.state || {}), __uiOverlay: token }, "");
          backPending.current = false;
        }
      }, 0);
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
    backPending.current = false;
  }, [open, token]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSheet();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={header ? undefined : "sheet-title"}
        aria-label={header ? title : undefined}
        className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-paperLine bg-white shadow-xl sm:max-w-xl sm:rounded-2xl"
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
                <h2 id="sheet-title" className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
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
    </div>
  );

  function closeSheet() {
    if (historyAdded.current && window.history.state?.__uiOverlay === token) {
      window.history.back();
    } else {
      onClose();
    }
  }
}
