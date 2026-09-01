import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { pinToPassword, randomPinEmail, PIN_PATTERN } from "../lib/auth";
import PinPad from "../components/PinPad";

export default function Register() {
  const [step, setStep] = useState(1); // 1: ชื่อ, 2: ตั้ง PIN, 3: ยืนยัน PIN
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function goToPinStep(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    setError("");
    setStep(2);
  }

  function confirmFirstPin() {
    if (!PIN_PATTERN.test(pin)) {
      setError("PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }
    setError("");
    setStep(3);
  }

  async function finish() {
    if (pinConfirm !== pin) {
      setError("PIN ยืนยันไม่ตรงกับที่ตั้งไว้ ลองใหม่อีกครั้ง");
      setPinConfirm("");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const existing = await getDoc(doc(db, "pinDirectory", pin));
      if (existing.exists()) {
        setError("PIN นี้ถูกใช้งานแล้ว กรุณาเลือก PIN อื่น");
        setPin("");
        setPinConfirm("");
        setStep(2);
        setBusy(false);
        return;
      }

      const email = randomPinEmail();
      const cred = await createUserWithEmailAndPassword(auth, email, pinToPassword(pin));

      // สร้างโปรไฟล์ในสถานะ "pending" — ต้องรอเจ้าของร้านอนุมัติสิทธิ์ก่อนใช้งานได้
      await setDoc(doc(db, "users", cred.user.uid), {
        name: name.trim(),
        pin,
        role: "pending",
        createdAt: serverTimestamp(),
      });
      // ผูก PIN นี้กับบัญชี เพื่อให้หน้า Login ค้นหาเจอตอนพิมพ์ PIN
      await setDoc(doc(db, "pinDirectory", pin), { uid: cred.user.uid, email });

      navigate("/pending");
    } catch (err) {
      console.error(err);
      setError("สมัครไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white border border-paperLine rounded-lg p-6 receipt-edge text-center">
        <h1 className="font-slab text-xl mb-1">ลงทะเบียนพนักงานใหม่</h1>
        <p className="text-sm text-inkSoft mb-5">
          บัญชีใหม่จะอยู่ในสถานะ "รออนุมัติ" จนกว่าเจ้าของร้านจะกำหนดสิทธิ์ให้
        </p>

        {step === 1 && (
          <form onSubmit={goToPinStep} className="space-y-3 text-left">
            <div>
              <label className="text-sm text-inkSoft block mb-1">ชื่อ-นามสกุล</label>
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
              />
            </div>
            {error && <p className="text-sm text-rust">{error}</p>}
            <button
              type="submit"
              className="w-full bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark"
            >
              ถัดไป
            </button>
          </form>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">ตั้ง PIN สำหรับเข้าสู่ระบบ (4-6 หลัก)</p>
            <PinPad value={pin} onChange={setPin} maxLength={6} />
            {error && <p className="text-sm text-rust mt-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                className="flex-1 border border-paperLine rounded py-2.5 text-sm"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={confirmFirstPin}
                disabled={pin.length < 4}
                className="flex-1 bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">พิมพ์ PIN อีกครั้งเพื่อยืนยัน</p>
            <PinPad value={pinConfirm} onChange={setPinConfirm} maxLength={pin.length} disabled={busy} />
            {error && <p className="text-sm text-rust mt-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setPinConfirm("");
                  setError("");
                }}
                disabled={busy}
                className="flex-1 border border-paperLine rounded py-2.5 text-sm"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={finish}
                disabled={busy || pinConfirm.length < pin.length}
                className="flex-1 bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark disabled:opacity-40"
              >
                {busy ? "กำลังสมัคร..." : "ยืนยันสมัครใช้งาน"}
              </button>
            </div>
          </div>
        )}

        <p className="text-sm text-inkSoft mt-5">
          มีบัญชีอยู่แล้ว?{" "}
          <Link to="/login" className="text-teal font-medium">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
