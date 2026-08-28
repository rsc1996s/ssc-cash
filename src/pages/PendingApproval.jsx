import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function PendingApproval() {
  const navigate = useNavigate();
  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white border border-paperLine rounded-lg p-6 text-center receipt-edge">
        <div className="stamp text-amber inline-flex mb-4">รออนุมัติ</div>
        <h1 className="font-slab text-lg mb-2">บัญชีของคุณรออนุมัติ</h1>
        <p className="text-sm text-inkSoft mb-5">
          กรุณาแจ้งเจ้าของร้านให้เข้าไปกำหนดสิทธิ์การใช้งานให้คุณในเมนู "ผู้ใช้งาน"
        </p>
        <button onClick={handleLogout} className="text-sm border border-paperLine rounded px-3 py-2">
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
