import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  pinToPassword,
  PIN_PATTERN,
  LEGACY_PIN_PATTERN,
  normalizeUsername,
  USERNAME_PATTERN,
} from "../lib/auth";
import PinPad from "../components/PinPad";
import { useAuth } from "../context/AuthContext";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function Login() {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loginMode, setLoginMode] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getDoc(doc(db, "meta", "setup"))
      .then((snap) => setLoginMode(snap.exists() ? snap.data().loginMode || "pin" : "pin"))
      .catch((err) => {
        console.error(err);
        setError("โหลดการตั้งค่าการเข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง");
      });
  }, []);

  async function handleSubmit() {
    setError("");
    const normalizedUsername = normalizeUsername(username);
    if (loginMode === "username" && !USERNAME_PATTERN.test(normalizedUsername)) {
      setError("ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข 3-24 ตัว และขึ้นต้นด้วยตัวอักษร");
      return;
    }
    const validPin = loginMode === "username"
      ? PIN_PATTERN.test(pin)
      : LEGACY_PIN_PATTERN.test(pin);
    if (!validPin) {
      setError(loginMode === "username" ? "PIN ต้องเป็นตัวเลข 6 หลัก" : "PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }
    setBusy(true);
    try {
      const loginId = loginMode === "username" ? normalizedUsername : pin;
      const dirSnap = await getDoc(doc(db, "pinDirectory", loginId));
      if (!dirSnap.exists()) {
        setError("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง");
        return;
      }
      const { email } = dirSnap.data();
      await signInWithEmailAndPassword(auth, email, pinToPassword(pin));
      navigate("/");
    } catch (err) {
      setError("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisabledLogout() {
    await signOut(auth);
  }

  if (user && profile?.disabled === true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-4">
        <div className="w-full max-w-sm bg-white border border-paperLine rounded-lg p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">บัญชีถูกปิดใช้งาน</h1>
          <p className="text-sm text-inkSoft mb-5">กรุณาติดต่อเจ้าของร้านเพื่อขอเปิดใช้งานอีกครั้ง</p>
          <button onClick={handleDisabledLogout} className="text-sm border border-paperLine rounded px-3 py-2">
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white border border-paperLine rounded-lg p-6 text-center">
        <h1 className="text-xl font-semibold mb-1">เข้าสู่ระบบ</h1>
        <p className="text-sm text-inkSoft mb-5">บันทึกรายรับ-รายจ่ายหน้าร้าน</p>

        {loginMode === null ? (
          <p className="text-sm text-inkSoft">กำลังโหลดการตั้งค่าการเข้าสู่ระบบ...</p>
        ) : (
          <>
            {loginMode === "username" && (
              <>
                <label htmlFor="login-username" className="text-sm text-inkSoft block text-left mb-1">
                  ชื่อผู้ใช้
                </label>
                <Input
                  id="login-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border border-paperLine rounded px-3 py-2 mb-4 text-left"
                />
              </>
            )}
            <p className="text-sm text-inkSoft mb-3">
              {loginMode === "username" ? "กรอก PIN 6 หลัก" : "กรอก PIN เดิม 4-6 หลัก"}
            </p>
            <PinPad value={pin} onChange={setPin} maxLength={6} disabled={busy} />
          </>
        )}

        {error && <p className="text-sm text-rust mt-3">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={
            busy ||
            loginMode === null ||
            (loginMode === "username" ? pin.length !== 6 : pin.length < 4) ||
            (loginMode === "username" && !username.trim())
          }
          className="w-full bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark disabled:opacity-40 mt-4"
        >
          {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </Button>

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
