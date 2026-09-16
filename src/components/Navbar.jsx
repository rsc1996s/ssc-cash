import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { initials } from "./Sidebar";
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
} from "lucide-react";

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
    <>
      {/* แถบบน — โลโก้ + ปุ่มเปิดเมนู/โปรไฟล์ */}
      <header className="no-print lg:hidden bg-ink text-paper sticky top-0 z-20">
        <div className="px-4 flex items-center justify-between h-14">
          <Link to="/" className="font-slab text-base tracking-tight truncate">
            บันทึกเงินสดหน้าร้าน
          </Link>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md pl-1 pr-2 py-1 hover:bg-white/10 transition-colors shrink-0"
          >
            <span className="w-7 h-7 rounded-full bg-teal flex items-center justify-center text-xs font-semibold">
              {initials(profile?.name)}
            </span>
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* แผงเมนูเต็ม — bottom sheet เปิดจากแท็บ "เมนู" หรือปุ่มโปรไฟล์มุมบน */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 flex flex-col justify-end"
          onClick={() => setMenuOpen(false)}
        >
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
                onClick={() => setMenuOpen(false)}
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

      {/* แถบเมนูล่าง — เข้าถึงเมนูหลักโดยไม่ต้องเอื้อมขึ้นบน */}
      <MobileTabBar
        isOwner={isOwner}
        isStaff={isStaff}
        isGuest={isGuest}
        pendingTxCount={pendingTxCount}
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
    <nav className="lg:hidden no-print fixed bottom-0 inset-x-0 z-20 bg-white border-t border-paperLine flex items-stretch pb-[env(safe-area-inset-bottom)]">
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
