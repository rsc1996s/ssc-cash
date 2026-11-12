import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { initials } from "./Sidebar";
import { PlusCircle, KeyRound, LogOut, Menu, X } from "lucide-react";
import { getNavItems } from "./navItems";

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-rust text-white text-[10px] font-nums leading-none">
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
  }, [location.pathname]);

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
      <header className="no-print lg:hidden sticky top-0 z-20 border-b border-paperLine bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
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
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium ${
                    isActive(item.to) ? "bg-blue-50 text-blue-700" : "text-ink hover:bg-blue-50"
                  }`}
                >
                  <item.icon size={19} strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                  <NavBadge count={item.badge} />
                </Link>
              ))}
              <div className="my-2 border-t border-paperLine" />
              <Link
                to="/change-pin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium text-ink hover:bg-blue-50"
              >
                <KeyRound size={19} className="text-inkSoft" />
                เปลี่ยน PIN
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium text-rust hover:bg-red-50"
              >
                <LogOut size={19} />
                ออกจากระบบ
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* แถบเมนูล่าง — เข้าถึงเมนูหลักโดยไม่ต้องเอื้อมขึ้นบน */}
      <MobileTabBar
        isGuest={isGuest}
        navItems={navItems}
        isActive={isActive}
        onOpenMenu={() => setMenuOpen(true)}
      />
    </>
  );
}

function TabItem({ to, icon: Icon, label, badge, active, onClick }) {
  const content = (
    <>
      <span className="relative">
        <Icon size={21} strokeWidth={active ? 2.3 : 2} />
        {!!badge && (
          <span className="absolute -right-3 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full border border-white bg-rust px-1 text-[9px] leading-none text-white">
            {badge}
          </span>
        )}
      </span>
      <span className={`text-xs leading-none ${active ? "font-semibold" : ""}`}>{label}</span>
    </>
  );
  const cls = `flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[60px] ${
    active ? "text-blue-700" : "text-inkSoft"
  }`;
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {content}
    </button>
  ) : (
    <Link to={to} className={cls}>
      {content}
    </Link>
  );
}

function MobileTabBar({ navItems, isGuest, isActive, onOpenMenu }) {
  const home = navItems.find((item) => item.to === "/");
  const settings = navItems.find((item) => item.to === "/settings");
  const firstContext =
    navItems.find((item) => item.to === "/owner") ||
    navItems.find((item) => item.to === "/transfers") ||
    navItems.find((item) => item.to === "/reports");
  const secondContext = navItems.find((item) => item.to === "/reports" && item !== firstContext);
  return (
    <nav className="lg:hidden no-print fixed bottom-0 inset-x-0 z-20 flex items-stretch border-t border-paperLine bg-white pb-[env(safe-area-inset-bottom)]">
      {home && <TabItem {...home} label="หน้าแรก" active={isActive("/")} />}
      {firstContext && <TabItem {...firstContext} label={firstContext.to === "/owner" ? "ตรวจสอบ" : firstContext.to === "/transfers" ? "ใบเบิก" : "รายงาน"} active={isActive(firstContext.to)} />}
      {!isGuest && (
        <Link to="/new" aria-label="เพิ่มรายการ" className="flex flex-1 flex-col items-center justify-center">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-blue-600 text-white shadow-lg">
            <PlusCircle size={24} />
          </span>
          <span className="text-xs font-medium text-blue-700">เพิ่ม</span>
        </Link>
      )}
      {secondContext && <TabItem {...secondContext} label="รายงาน" active={isActive(secondContext.to)} />}
      {settings && <TabItem {...settings} label="ตั้งค่า" active={isActive(settings.to)} />}
      <TabItem icon={Menu} label="เมนู" onClick={onOpenMenu} />
    </nav>
  );
}
