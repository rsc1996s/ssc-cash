import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import NavigationLink from "./NavigationLink";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { initials } from "./Sidebar";
import { PlusCircle, KeyRound, LogOut, Menu, X } from "lucide-react";
import { getNavItems } from "./navItems";
import Sheet from "./ui/Sheet";

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
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);

  useEffect(() => {
    if (!isOwner) return;
    const unsub1 = onSnapshot(
      query(collection(db, "transactions"), where("status", "==", "pending")),
      (snap) => setPendingTxCount(snap.size)
    );
    const unsub2 = onSnapshot(
      query(collection(db, "users"), where("role", "==", "pending")),
      (snap) => setPendingUserCount(snap.size)
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, [isOwner]);

  useEffect(() => {
    setMenuOpen(false);
    setShortcutsOpen(false);
  }, [location.pathname]);

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
          <h1 className="truncate text-base font-semibold">{pageTitle}</h1>
          <button
            type="button"
            aria-label="เปิดเมนูบัญชี"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex shrink-0 items-center gap-2 rounded-md pl-1 pr-2 py-1 text-inkSoft transition-colors hover:bg-blue-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {initials(profile?.name)}
            </span>
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* แผงเมนูเต็ม — bottom sheet เปิดจากแท็บ "เมนู" หรือปุ่มโปรไฟล์มุมบน */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 flex flex-col justify-end"
          onClick={() => setMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/40" />
          <div
            className="relative max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white pb-[calc(6rem+env(safe-area-inset-bottom))] text-ink shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-paperLine sticky top-0 bg-white">
              <div>
                <div className="text-sm font-semibold">{profile?.name}</div>
                <div className="text-xs text-inkSoft">
                  {isOwner ? "เจ้าของ/ผู้จัดการ" : isStaff ? "พนักงาน" : "ผู้อ่าน (Guest)"}
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)} className="p-2 -mr-2 text-inkSoft">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col p-2">
              {navItems.map((item) => (
                <NavigationLink
                  key={item.label}
                  to={item.to}
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
          </div>
        </div>
      )}

      {/* แถบเมนูล่าง — เข้าถึงเมนูหลักโดยไม่ต้องเอื้อมขึ้นบน */}
      {!keyboardOpen && <MobileTabBar
        isGuest={isGuest}
        navItems={navItems}
        isActive={isActive}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />}
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

function TabItem({ to, icon: Icon, label, badge, active, onClick }) {
  const content = (
    <>
      <span className="relative">
        <Icon size={20} strokeWidth={1.5} />
        {!!badge && (
          <span className="absolute -right-3 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full border border-white bg-danger px-1 text-[9px] leading-none text-white">
            {badge}
          </span>
        )}
      </span>
      {active && <span className="text-xs font-semibold">{label}</span>}
    </>
  );
  const cls = `relative flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1 rounded-full px-2 ${
    active ? "bg-primary-light text-primary-dark" : "text-inkSoft"
  }`;
  return onClick ? (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {content}
    </button>
  ) : (
    <NavigationLink to={to} aria-label={label} aria-current={active ? "page" : undefined} className={cls}>
      {content}
    </NavigationLink>
  );
}

function MobileTabBar({ navItems, isGuest, isActive, onOpenMenu, onOpenShortcuts }) {
  const home = navItems.find((item) => item.to === "/");
  const settings = navItems.find((item) => item.to === "/settings");
  const firstContext =
    navItems.find((item) => item.to === "/owner") ||
    navItems.find((item) => item.to === "/transfers") ||
    navItems.find((item) => item.to === "/reports");
  const secondContext = navItems.find((item) => item.to === "/reports" && item !== firstContext);
  return (
    <nav aria-label="เมนูหลัก" className="no-print fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 lg:hidden">
      <div className="aurora-mobile-nav flex min-w-0 flex-1 items-center gap-1 rounded-full border border-white/80 p-1.5 shadow-glass">
      {home && <TabItem {...home} label="หน้าแรก" active={isActive("/")} />}
      {firstContext && <TabItem {...firstContext} label={firstContext.to === "/owner" ? "ตรวจสอบ" : firstContext.to === "/transfers" ? "ใบเบิก" : "รายงาน"} active={isActive(firstContext.to)} />}
      {secondContext && <TabItem {...secondContext} label="รายงาน" active={isActive(secondContext.to)} />}
      {settings && <TabItem {...settings} label="ตั้งค่า" active={isActive(settings.to)} />}
      <TabItem icon={Menu} label="เมนู" onClick={onOpenMenu} />
      </div>
      {!isGuest && (
        <button type="button" aria-label="เปิดทางลัดเพิ่มรายการ" onClick={onOpenShortcuts} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-glow">
          <PlusCircle size={24} strokeWidth={1.5} />
        </button>
      )}
    </nav>
  );
}
