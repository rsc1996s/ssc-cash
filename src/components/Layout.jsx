import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { profile, isOwner } = useAuth();
  const navigate = useNavigate();

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
              รายการของฉัน
            </Link>
            <Link to="/new" className="hover:text-teal">
              + บันทึกใหม่
            </Link>
            {isOwner && (
              <>
                <Link to="/owner" className="hover:text-teal">
                  ตรวจสอบทั้งหมด
                </Link>
                <Link to="/admin/users" className="hover:text-teal">
                  ผู้ใช้งาน
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
