import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/");
    } catch (err) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white border border-paperLine rounded-lg p-6 receipt-edge">
        <h1 className="font-slab text-xl mb-1">เข้าสู่ระบบ</h1>
        <p className="text-sm text-inkSoft mb-5">บันทึกรายรับ-รายจ่ายหน้าร้าน</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-inkSoft block mb-1">อีเมล</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">รหัสผ่าน</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            />
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-teal text-white rounded py-2 font-medium hover:bg-teal-dark disabled:opacity-60"
          >
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        <p className="text-sm text-inkSoft mt-4">
          ยังไม่มีบัญชี?{" "}
          <Link to="/register" className="text-teal font-medium">
            สมัครใช้งาน
          </Link>
        </p>
      </div>
    </div>
  );
}
