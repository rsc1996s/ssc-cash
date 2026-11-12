import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export default function PageHeader({ title, fallbackTo = "/", right = null }) {
  const location = useLocation();
  const navigate = useNavigate();

  function goBack() {
    if (location.state?.pageHeaderFallback) {
      navigate(location.state.pageHeaderFallback, { replace: true });
      return;
    }
    if (location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(fallbackTo, { replace: true });
  }

  return (
    <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-4 flex min-h-16 items-center gap-2 border-b border-paperLine bg-white/95 px-4 py-2 shadow-sm backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:rounded-xl lg:border lg:px-4">
      <button
        type="button"
        onClick={goBack}
        aria-label="ย้อนกลับ"
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-paperLine text-ink hover:bg-blue-50"
      >
        <ArrowLeft size={20} />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold sm:text-lg">{title}</h1>
      <div className="flex min-h-11 min-w-11 shrink-0 items-center justify-end">{right}</div>
    </header>
  );
}
