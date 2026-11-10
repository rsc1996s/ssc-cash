import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  PlusCircle,
  KeyRound,
  LogOut,
} from "lucide-react";
import { getNavItems } from "./navItems";

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-rust text-white text-[10px] font-nums leading-none">
      {count}
    </span>
  );
}

export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

export const SIDEBAR_WIDTH = "w-64";

export default function Sidebar() {
  const { profile, isOwner, isGuest, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  const isActive = (path) => location.pathname === path;

  const navItems = getNavItems({ isOwner, isGuest, isStaff, pendingTxCount, pendingUserCount });

  return (
    <aside
      className={`no-print hidden lg:flex flex-col fixed inset-y-0 left-0 ${SIDEBAR_WIDTH} bg-white text-ink border-r border-paperLine z-20`}
    >
      <div className="px-5 py-5 border-b border-paperLine shrink-0">
        <Link to="/" className="font-slab text-lg leading-snug block">
          บันทึกเงินสดหน้าร้าน
        </Link>
      </div>

      {!isGuest && (
        <div className="px-4 pt-4 shrink-0">
          <Link
            to="/new"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            <PlusCircle size={18} />
            บันทึกใหม่
          </Link>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.to) ? "bg-blue-50 text-blue-700" : "text-inkSoft hover:text-blue-700 hover:bg-blue-50"
            }`}
          >
            <item.icon size={18} strokeWidth={2} />
            <span className="flex-1">{item.label}</span>
            <NavBadge count={item.badge} />
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-paperLine shrink-0">
        <div className="flex items-center gap-2.5 px-2 mb-2 py-1.5">
          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
            {initials(profile?.name)}
          </span>
          <div className="min-w-0">
            <div className="text-sm text-ink truncate">{profile?.name}</div>
            <div className="text-xs text-inkSoft">
              {isOwner ? "เจ้าของ/ผู้จัดการ" : isStaff ? "พนักงาน" : "ผู้อ่าน (Guest)"}
            </div>
          </div>
        </div>
        <Link
          to="/change-pin"
          className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-sm text-inkSoft hover:bg-blue-50"
        >
          <KeyRound size={16} />
          เปลี่ยน PIN
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-sm text-rust hover:bg-red-50"
        >
          <LogOut size={16} />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
