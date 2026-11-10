import { Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import Loading from "./ui/Loading";

export default function ProtectedRoute({ children, requireRole }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-4">
        <div className="w-full max-w-sm">
          <Loading label="กำลังตรวจสอบบัญชี" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profile?.disabled === true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-4">
        <div className="max-w-sm bg-white border border-paperLine rounded-lg p-6 text-center">
          <h1 className="font-slab text-lg mb-2">บัญชีถูกปิดใช้งาน</h1>
          <p className="text-sm text-inkSoft mb-4">กรุณาติดต่อเจ้าของร้านเพื่อขอเปิดใช้งานอีกครั้ง</p>
          <button
            onClick={() => signOut(auth)}
            className="text-sm border border-paperLine rounded px-3 py-2"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  if (!profile || profile.role === "pending") {
    return <Navigate to="/pending" replace />;
  }

  if (requireRole) {
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!allowed.includes(profile.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
