import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ORGANIZATION } from "../config/org";

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // ถ้า role ถูกอนุมัติ/เปลี่ยนแล้ว (ไม่ใช่ pending อีกต่อไป) ให้พากลับหน้าหลักอัตโนมัติทันที
  // ไม่ต้องรอผู้ใช้กดรีเฟรชหรือออกจากระบบแล้วเข้าใหม่เอง
  useEffect(() => {
    if (profile && profile.role !== "pending") {
      navigate("/", { replace: true });
    }
  }, [profile, navigate]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }
  return (
    <div className="aurora-auth min-h-screen flex items-center justify-center px-4">
      <div className="aurora-auth-card w-full max-w-sm border border-white rounded-card p-6 text-center">
        <p className="mb-2 text-sm font-medium text-primary-dark">{ORGANIZATION.name}</p>
        <div className="mb-4 inline-flex rounded-full bg-warning-light px-3 py-1 text-sm font-semibold text-warning">รออนุมัติ</div>
        <h1 className="text-lg font-semibold mb-2">บัญชีของคุณรออนุมัติ</h1>
        <p className="text-sm text-inkSoft mb-5">
          กรุณาแจ้งเจ้าของร้านให้เข้าไปกำหนดสิทธิ์การใช้งานให้คุณในเมนู "ผู้ใช้งาน"
        </p>

        {/* ข้อมูลดีบักสำหรับเทียบกับ Firestore Console เวลาสงสัยว่าล็อกอินเป็นบัญชีไหนอยู่ */}
        <div className="text-left bg-paper border border-paperLine rounded p-3 mb-5 text-xs font-nums break-all">
          <div className="text-inkSoft mb-1">ข้อมูลสำหรับตรวจสอบ:</div>
          <div>UID: {user?.uid || "-"}</div>
          <div>
            สถานะเอกสารใน Firestore:{" "}
            {profile === null ? "ไม่พบเอกสาร (ยังไม่เคยสร้าง หรือถูกลบไปแล้ว)" : `พบแล้ว role = "${profile.role}"`}
          </div>
        </div>

        <button onClick={handleLogout} className="text-sm border border-paperLine rounded px-3 py-2">
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
