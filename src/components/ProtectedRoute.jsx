import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requireRole }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-inkSoft font-nums">
        กำลังโหลด...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!profile || profile.role === "pending") {
    return <Navigate to="/pending" replace />;
  }

  if (requireRole && profile.role !== requireRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}
