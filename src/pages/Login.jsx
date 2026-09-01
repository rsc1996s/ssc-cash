import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { pinToPassword, PIN_PATTERN } from "../lib/auth";
import PinPad from "../components/PinPad";

export default function Login() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit() {
    setError("");
    if (!PIN_PATTERN.test(pin)) {
      setError("PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }
    setBusy(true);
    try {
      const dirSnap = await getDoc(doc(db, "pinDirectory", pin));
      if (!dirSnap.exists()) {
        setError("PIN ไม่ถูกต้อง");
        setBusy(false);
        return;
      }
      const { email } = dirSnap.data();
      await signInWithEmailAndPassword(auth, email, pinToPassword(pin));
      navigate("/");
    } catch (err) {
      setError("PIN ไม่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white border border-paperLine rounded-lg p-6 receipt-edge text-center">
        <h1 className="font-slab text-xl mb-1">กรอก PIN เพื่อเข้าสู่ระบบ</h1>
        <p className="text-sm text-inkSoft mb-5">บันทึกรายรับ-รายจ่ายหน้าร้าน</p>

        <PinPad value={pin} onChange={setPin} maxLength={6} disabled={busy} />

        {error && <p className="text-sm text-rust mt-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy || pin.length < 4}
          className="w-full bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark disabled:opacity-40 mt-4"
        >
          {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        <p className="text-sm text-inkSoft mt-4">
          พนักงานใหม่?{" "}
          <Link to="/register" className="text-teal font-medium">
            ลงทะเบียนที่นี่
          </Link>
        </p>
      </div>
    </div>
  );
}
