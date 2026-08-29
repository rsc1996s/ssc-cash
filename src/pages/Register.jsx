import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  usernameToEmail,
  pinToPassword,
  normalizeUsername,
  USERNAME_PATTERN,
  PIN_PATTERN,
} from "../lib/auth";

export default function Register() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    if (!USERNAME_PATTERN.test(username.trim())) {
      setError("ชื่อผู้ใช้ต้องมี 3-20 ตัวอักษร (a-z, 0-9, . _ - เท่านั้น ห้ามเว้นวรรค)");
      return;
    }
    if (!PIN_PATTERN.test(pin.trim())) {
      setError("PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PIN ทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        usernameToEmail(username),
        pinToPassword(pin)
      );
      // สร้างโปรไฟล์ในสถานะ "pending" — ต้องรอเจ้าของร้านอนุมัติสิทธิ์ก่อนใช้งานได้
      await setDoc(doc(db, "users", cred.user.uid), {
        name: name.trim(),
        username: normalizeUsername(username),
        role: "pending",
        createdAt: serverTimestamp(),
      });
      navigate("/pending");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว ลองชื่ออื่น");
      } else if (err.code === "auth/weak-password") {
        setError("PIN สั้นเกินไป กรุณาใช้อย่างน้อย 4 หลัก");
      } else {
        setError("สมัครไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white border border-paperLine rounded-lg p-6 receipt-edge">
        <h1 className="font-slab text-xl mb-1">สมัครใช้งาน</h1>
        <p className="text-sm text-inkSoft mb-5">
          บัญชีใหม่จะอยู่ในสถานะ "รออนุมัติ" จนกว่าเจ้าของร้านจะกำหนดสิทธิ์ให้
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-inkSoft block mb-1">ชื่อ-นามสกุล</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">ชื่อผู้ใช้ (ใช้ล็อกอิน)</label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="เช่น somchai01"
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">ตั้ง PIN (4-6 หลัก)</label>
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
          <div>
            <label className="text-sm text-inkSoft block mb-1">ยืนยัน PIN อีกครั้ง</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              required
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-paperLine rounded px-3 py-2 tracking-[0.3em] text-center font-nums focus:border-teal"
            />
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-teal text-white rounded py-2 font-medium hover:bg-teal-dark disabled:opacity-60"
          >
            {busy ? "กำลังสมัคร..." : "สมัครใช้งาน"}
          </button>
        </form>
        <p className="text-sm text-inkSoft mt-4">
          มีบัญชีอยู่แล้ว?{" "}
          <Link to="/login" className="text-teal font-medium">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
