import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-rust text-white text-[10px] font-nums leading-none">
      {count}
    </span>
  );
}

export default function Layout({ children }) {
  const { profile, isOwner, isGuest, isStaff } = useAuth();
  const navigate = useNavigate();
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);

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

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="no-print bg-ink text-paper">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-slab text-lg tracking-tight">
            บันทึกเงินสดหน้าร้าน
          </Link>
          <nav className="flex items-center gap-4 text-sm flex-wrap">
            <Link to="/" className="hover:text-teal">
              {isGuest ? "รายการทั้งหมด" : "รายการของฉัน"}
            </Link>
            {!isGuest && (
              <Link to="/new" className="hover:text-teal">
                + บันทึกใหม่
              </Link>
            )}
            {isStaff && (
              <Link to="/transfers" className="hover:text-teal">
                ใบเบิกเงินโอน
              </Link>
            )}
            {isGuest && (
              <Link to="/reports" className="hover:text-teal">
                รายงาน
              </Link>
            )}
            {isOwner && (
              <>
                <Link to="/owner" className="hover:text-teal flex items-center">
                  ตรวจสอบทั้งหมด
                  <NavBadge count={pendingTxCount} />
                </Link>
                <Link to="/admin/users" className="hover:text-teal flex items-center">
                  ผู้ใช้งาน
                  <NavBadge count={pendingUserCount} />
                </Link>
                <Link to="/admin/funds" className="hover:text-teal">
                  กองทุน
                </Link>
                <Link to="/reports" className="hover:text-teal">
                  รายงาน
                </Link>
                <Link to="/transfers" className="hover:text-teal">
                  โอนจ่าย
                </Link>
              </>
            )}
            <span className="text-inkSoft">|</span>
            <span className="text-xs text-paper/70">{profile?.name}</span>
            <Link to="/change-pin" className="text-xs hover:text-teal">
              เปลี่ยน PIN
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs border border-paper/40 rounded px-2 py-1 hover:bg-paper/10"
            >
              ออกจากระบบ
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
