import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  Receipt,
  PlusCircle,
  ClipboardCheck,
  Users,
  Wallet,
  BarChart3,
  ArrowLeftRight,
  FileText,
  KeyRound,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-rust text-white text-[10px] font-nums leading-none">
      {count}
    </span>
  );
}

function NavLink({ to, icon: Icon, label, badge, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? "bg-white/10 text-white" : "text-paper/75 hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon size={17} strokeWidth={2} />
      <span>{label}</span>
      <NavBadge count={badge} />
    </Link>
  );
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

export default function Navbar() {
  const { profile, isOwner, isGuest, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const profileRef = useRef(null);

  // แจ้งเตือนเฉพาะเจ้าของร้าน: มีกี่รายการรออนุมัติ / กี่บัญชีรอกำหนดสิทธิ์
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

  // ปิด dropdown โปรไฟล์เมื่อคลิกนอกกรอบ
  useEffect(() => {
    function onClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ปิดเมนูมือถือทุกครั้งที่เปลี่ยนหน้า
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { to: "/", icon: Receipt, label: isGuest ? "รายการทั้งหมด" : "รายการของฉัน", show: true },
    { to: "/transfers", icon: FileText, label: "ใบเบิกเงินโอน", show: isStaff },
    { to: "/owner", icon: ClipboardCheck, label: "ตรวจสอบทั้งหมด", badge: pendingTxCount, show: isOwner },
    { to: "/admin/users", icon: Users, label: "ผู้ใช้งาน", badge: pendingUserCount, show: isOwner },
    { to: "/admin/funds", icon: Wallet, label: "กองทุน", show: isOwner },
    { to: "/reports", icon: BarChart3, label: "รายงาน", show: isOwner || isGuest },
    { to: "/transfers", icon: ArrowLeftRight, label: "โอนจ่าย", show: isOwner },
  ].filter((item) => item.show);

  return (
    <header className="no-print bg-ink text-paper sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* โลโก้/ชื่อระบบ */}
          <Link to="/" className="font-slab text-base sm:text-lg tracking-tight shrink-0">
            บันทึกเงินสดหน้าร้าน
          </Link>

          {/* เมนูหลัก — เดสก์ท็อป */}
          <nav className="hidden lg:flex items-center gap-1 mx-4">
            {navItems.map((item) => (
              <NavLink key={item.label} {...item} active={isActive(item.to)} />
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {/* ปุ่ม Action หลัก — โชว์เฉพาะจอใหญ่ (จอเล็กมีปุ่ม + ลอยที่แถบล่างแทนแล้ว) */}
            {!isGuest && (
              <Link
                to="/new"
                className="hidden lg:flex items-center gap-1.5 bg-teal hover:bg-teal-dark text-white rounded-md px-3.5 py-2 text-sm font-medium transition-colors"
              >
                <PlusCircle size={17} />
                บันทึกใหม่
              </Link>
            )}

            {/* โปรไฟล์ผู้ใช้งาน */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10 transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials(profile?.name)}
                </span>
                <span className="hidden md:inline text-sm text-paper/85 max-w-[9rem] truncate">
                  {profile?.name}
                </span>
                <ChevronDown size={15} className="hidden md:inline text-paper/60" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white text-ink rounded-lg shadow-lg border border-paperLine overflow-hidden">
                  <div className="px-4 py-3 border-b border-paperLine">
                    <div className="text-sm font-medium truncate">{profile?.name}</div>
                    <div className="text-xs text-inkSoft">
                      {isOwner ? "เจ้าของ/ผู้จัดการ" : isStaff ? "พนักงาน" : "ผู้อ่าน (Guest)"}
                    </div>
                  </div>
                  <Link
                    to="/change-pin"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-paper"
                  >
                    <KeyRound size={16} className="text-inkSoft" />
                    เปลี่ยน PIN
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rust hover:bg-paper"
                  >
                    <LogOut size={16} />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>

            {/* ปุ่มเมนูมือถือ — โชว์เฉพาะจอกลาง (md) ที่ยังไม่มีแถบเมนูล่างแบบมือถือจริง */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="hidden md:flex lg:hidden items-center justify-center w-9 h-9 rounded-md hover:bg-white/10"
              aria-label="เมนู"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* เมนูหลัก — แท็บเล็ต (md) เมื่อกดปุ่มแฮมเบอร์เกอร์ */}
      {mobileOpen && (
        <div className="hidden md:block lg:hidden border-t border-white/10 bg-ink">
          <nav className="max-w-6xl mx-auto px-4 py-2 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink key={item.label} {...item} active={isActive(item.to)} />
            ))}
          </nav>
        </div>
      )}

      {/* แผงเมนูเต็ม — เปิดจากแท็บ "เมนู" ที่แถบล่างบนมือถือจริง */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex flex-col justify-end" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-ink/40" />
          <div
            className="relative bg-white text-ink rounded-t-2xl shadow-lg pb-24 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-paperLine sticky top-0 bg-white">
              <div>
                <div className="text-sm font-medium">{profile?.name}</div>
                <div className="text-xs text-inkSoft">
                  {isOwner ? "เจ้าของ/ผู้จัดการ" : isStaff ? "พนักงาน" : "ผู้อ่าน (Guest)"}
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 -mr-2 text-inkSoft">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col p-2">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium ${
                    isActive(item.to) ? "bg-teal-light text-teal-dark" : "text-ink hover:bg-paper"
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
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium text-ink hover:bg-paper"
              >
                <KeyRound size={19} className="text-inkSoft" />
                เปลี่ยน PIN
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3.5 rounded-lg text-sm font-medium text-rust hover:bg-paper"
              >
                <LogOut size={19} />
                ออกจากระบบ
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* แถบเมนูล่าง — เฉพาะมือถือจริง (ใต้ md) เข้าถึงเมนูหลักได้โดยไม่ต้องเอื้อมขึ้นบน */}
      <MobileTabBar
        isOwner={isOwner}
        isStaff={isStaff}
        isGuest={isGuest}
        pendingTxCount={pendingTxCount}
        isActive={isActive}
        onOpenMenu={() => setMobileOpen(true)}
      />
    </header>
  );
}

function TabItem({ to, icon: Icon, label, badge, active, onClick }) {
  const content = (
    <>
      <span className="relative">
        <Icon size={21} strokeWidth={active ? 2.3 : 2} />
        {!!badge && (
          <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rust border border-white" />
        )}
      </span>
      <span className={`text-[10.5px] leading-none ${active ? "font-semibold" : ""}`}>{label}</span>
    </>
  );
  const cls = `flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[54px] ${
    active ? "text-teal" : "text-inkSoft"
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

function MobileTabBar({ isOwner, isStaff, isGuest, pendingTxCount, isActive, onOpenMenu }) {
  const contextual = [];
  if (isOwner) {
    contextual.push({ to: "/owner", icon: ClipboardCheck, label: "ตรวจสอบ", badge: pendingTxCount });
    contextual.push({ to: "/reports", icon: BarChart3, label: "รายงาน" });
  } else if (isStaff) {
    contextual.push({ to: "/transfers", icon: FileText, label: "ใบเบิก" });
  } else if (isGuest) {
    contextual.push({ to: "/reports", icon: BarChart3, label: "รายงาน" });
  }
  const left = contextual.slice(0, 1);
  const right = contextual.slice(1);

  return (
    <nav className="md:hidden no-print fixed bottom-0 inset-x-0 z-20 bg-white border-t border-paperLine flex items-stretch pb-[env(safe-area-inset-bottom)]">
      <TabItem to="/" icon={Receipt} label="หน้าแรก" active={isActive("/")} />
      {left.map((item) => (
        <TabItem key={item.label} {...item} active={isActive(item.to)} />
      ))}
      {!isGuest && (
        <Link to="/new" className="flex-1 flex flex-col items-center justify-center">
          <span className="w-12 h-12 -mt-5 rounded-full bg-teal text-white flex items-center justify-center shadow-lg border-4 border-white">
            <PlusCircle size={24} />
          </span>
        </Link>
      )}
      {right.map((item) => (
        <TabItem key={item.label} {...item} active={isActive(item.to)} />
      ))}
      <TabItem icon={Menu} label="เมนู" onClick={onOpenMenu} />
    </nav>
  );
}
