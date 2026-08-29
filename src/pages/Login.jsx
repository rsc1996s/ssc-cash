import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { usernameToEmail, pinToPassword, USERNAME_PATTERN, PIN_PATTERN } from "../lib/auth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!USERNAME_PATTERN.test(username.trim())) {
      setError("ชื่อผู้ใช้ต้องมี 3-20 ตัวอักษร (a-z, 0-9, . _ - เท่านั้น)");
      return;
    }
    if (!PIN_PATTERN.test(pin.trim())) {
      setError("PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }

    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(username), pinToPassword(pin));
      navigate("/");
    } catch (err) {
      setError("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง");
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
            <label className="text-sm text-inkSoft block mb-1">ชื่อผู้ใช้</label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">PIN (4-6 หลัก)</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-paperLine rounded px-3 py-2 tracking-[0.3em] text-center font-nums focus:border-teal"
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
