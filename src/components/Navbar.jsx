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
            {/* ปุ่ม Action หลัก — เด่นแยกจากเมนูอื่น อยู่ติดตากันตลอดทุกขนาดจอ */}
            {!isGuest && (
              <Link
                to="/new"
                className="flex items-center gap-1.5 bg-teal hover:bg-teal-dark text-white rounded-md px-2.5 sm:px-3.5 py-2 text-sm font-medium transition-colors"
              >
                <PlusCircle size={17} />
                <span className="hidden sm:inline">บันทึกใหม่</span>
              </Link>
            )}

            {/* โปรไฟล์ผู้ใช้งาน */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10 transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-teal flex items-center justify-center text-xs font-semibold shrink-0">
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
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-paper"
                  >
                    <KeyRound size={16} className="text-inkSoft" />
                    เปลี่ยน PIN
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rust hover:bg-paper"
                  >
                    <LogOut size={16} />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>

            {/* ปุ่มเมนูมือถือ */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-white/10"
              aria-label="เมนู"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* เมนูหลัก — มือถือ/แท็บเล็ต (แสดงเมื่อกดปุ่มแฮมเบอร์เกอร์) */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-ink">
          <nav className="max-w-6xl mx-auto px-4 py-2 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink key={item.label} {...item} active={isActive(item.to)} />
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
