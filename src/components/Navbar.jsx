import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import NavigationLink from "./NavigationLink";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { initials } from "./Sidebar";
import { PlusCircle, KeyRound, LogOut, Menu } from "lucide-react";
import { getNavItems } from "./navItems";
import Sheet from "./ui/Sheet";
import useScopedCashData from "../hooks/useScopedCashData";

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-danger text-white text-[10px] font-nums leading-none">
      {count}
    </span>
  );
}

// แถบนี้ครอบคลุมเฉพาะจอมือถือ+แท็บเล็ต (ต่ำกว่า lg) — จอเดสก์ท็อป (lg+) ใช้ Sidebar.jsx แทนทั้งหมด
export default function Navbar() {
  const { profile, isOwner, isGuest, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { transactions } = useScopedCashData();
  const pendingTxCount = isOwner ? transactions.filter((row) => row.status === "pending").length : 0;
  const [pendingUserCount, setPendingUserCount] = useState(0);

  useEffect(() => {
    if (!isOwner) return;
    const unsub2 = onSnapshot(
      query(collection(db, "users"), where("role", "==", "pending")),
      (snap) => setPendingUserCount(snap.size)
    );
    return () => {
      unsub2();
    };
  }, [isOwner]);

  useEffect(() => {
    setMenuOpen(false);
    setShortcutsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    function closeMobileOverlays(event) {
      if (event.matches) {
        setMenuOpen(false);
        setShortcutsOpen(false);
      }
    }
    desktop.addEventListener("change", closeMobileOverlays);
    return () => desktop.removeEventListener("change", closeMobileOverlays);
  }, []);

  useEffect(() => {
    function updateFocus() {
      const active = document.activeElement;
      setKeyboardOpen(Boolean(active?.matches("input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, [contenteditable=true]")));
    }
    function onFocusOut() {
      window.setTimeout(updateFocus, 0);
    }
    document.addEventListener("focusin", updateFocus);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", updateFocus);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  const isActive = (path) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));

  const navItems = getNavItems({ isOwner, isGuest, isStaff, pendingTxCount, pendingUserCount });
  const currentPage = navItems.find(
    (item) => location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to))
  );
  const pageTitle = currentPage?.label || (
    location.pathname === "/new"
      ? "บันทึกรายการ"
      : location.pathname.startsWith("/transaction/")
        ? "รายละเอียดรายการ"
        : "ตั้งค่า"
  );

  return (
    <>
      <header className="no-print lg:hidden sticky top-0 z-20 border-b border-paperLine bg-white pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="truncate text-base font-semibold">SC-ACC <span className="font-normal text-inkSoft">· {pageTitle}</span></h1>
          <button
            type="button"
            aria-label="เปิดเมนูหลัก"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-md pl-1 pr-2 py-1 text-inkSoft transition-colors hover:bg-blue-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {initials(profile?.name)}
            </span>
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div className="lg:hidden">
        <Sheet open={menuOpen} title="เมนูหลัก" onClose={() => setMenuOpen(false)}>
            <div className="border-b border-paperLine px-3 pb-3">
              <div className="text-sm font-semibold">{profile?.name}</div>
              <div className="text-xs text-inkSoft">
                {isOwner ? "เจ้าของ/ผู้จัดการ" : isStaff ? "พนักงาน" : "ผู้อ่าน (Guest)"}
              </div>
            </div>
            <nav className="flex flex-col p-2">
              {navItems.map((item) => (
                <NavigationLink
                  key={item.label}
                  to={item.to}
                  aria-current={isActive(item.to) ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium ${
                    isActive(item.to) ? "bg-blue-50 text-blue-700" : "text-ink hover:bg-blue-50"
                  }`}
                >
                  <item.icon size={20} strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  <NavBadge count={item.badge} />
                </NavigationLink>
              ))}
              <div className="my-2 border-t border-paperLine" />
              <NavigationLink
                to="/change-pin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium text-ink hover:bg-blue-50"
              >
                <KeyRound size={19} className="text-inkSoft" />
                เปลี่ยน PIN
              </NavigationLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium text-danger hover:bg-red-50"
              >
                <LogOut size={19} />
                ออกจากระบบ
              </button>
            </nav>
        </Sheet>
      </div>

      {!isGuest && !keyboardOpen && (
        <button type="button" aria-label="เปิดทางลัดเพิ่มรายการ" onClick={() => setShortcutsOpen(true)}
          className="no-print fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-glow lg:hidden">
          <PlusCircle size={24} strokeWidth={1.5} />
        </button>
      )}
      <Sheet open={shortcutsOpen} title="ทางลัด" onClose={() => setShortcutsOpen(false)}>
        <div className="space-y-2">
          <NavigationLink to="/new" onClick={() => setShortcutsOpen(false)} className="flex min-h-12 items-center rounded-xl border border-paperLine px-4 font-medium hover:bg-primary-light">
            บันทึกรายการ
          </NavigationLink>
          <NavigationLink to="/transfers/withdrawals/new" onClick={() => setShortcutsOpen(false)} className="flex min-h-12 items-center rounded-xl border border-paperLine px-4 font-medium hover:bg-primary-light">
            ใบเบิกเงินโอน
          </NavigationLink>
        </div>
      </Sheet>
    </>
  );
}
