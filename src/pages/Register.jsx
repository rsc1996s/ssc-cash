import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Register() {
  const [name, setName] = useState("");
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
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // สร้างโปรไฟล์ในสถานะ "pending" — ต้องรอเจ้าของร้านอนุมัติสิทธิ์ก่อนใช้งานได้
      await setDoc(doc(db, "users", cred.user.uid), {
        name: name.trim(),
        email: email.trim(),
        role: "pending",
        createdAt: serverTimestamp(),
      });
      navigate("/pending");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("อีเมลนี้ถูกใช้งานแล้ว");
      } else if (err.code === "auth/weak-password") {
        setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
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
            <label className="text-sm text-inkSoft block mb-1">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
            <input
              type="password"
              required
              minLength={6}
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
