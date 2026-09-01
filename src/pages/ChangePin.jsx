import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import PinPad from "../components/PinPad";
import { pinToPassword, PIN_PATTERN } from "../lib/auth";

export default function ChangePin() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: PIN เดิม, 2: PIN ใหม่, 3: ยืนยัน PIN ใหม่
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function verifyCurrentPin() {
    if (!PIN_PATTERN.test(currentPin)) {
      setError("PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, pinToPassword(currentPin));
      await reauthenticateWithCredential(auth.currentUser, cred);
      setStep(2);
    } catch (err) {
      setError("PIN เดิมไม่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  }

  function goConfirmStep() {
    if (!PIN_PATTERN.test(newPin)) {
      setError("PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }
    if (newPin === currentPin) {
      setError("PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม");
      return;
    }
    setError("");
    setStep(3);
  }

  async function finish() {
    if (newPinConfirm !== newPin) {
      setError("PIN ยืนยันไม่ตรงกับที่ตั้งไว้ ลองใหม่อีกครั้ง");
      setNewPinConfirm("");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const existing = await getDoc(doc(db, "pinDirectory", newPin));
      if (existing.exists()) {
        setError("PIN นี้ถูกใช้งานแล้ว กรุณาเลือก PIN อื่น");
        setNewPin("");
        setNewPinConfirm("");
        setStep(2);
        setBusy(false);
        return;
      }

      await updatePassword(auth.currentUser, pinToPassword(newPin));
      await deleteDoc(doc(db, "pinDirectory", currentPin));
      await setDoc(doc(db, "pinDirectory", newPin), {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
      });
      await updateDoc(doc(db, "users", auth.currentUser.uid), { pin: newPin });

      setDone(true);
    } catch (err) {
      console.error(err);
      setError("เปลี่ยน PIN ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Layout>
        <div className="max-w-sm mx-auto bg-white border border-paperLine rounded-lg p-6 receipt-edge text-center">
          <div className="stamp text-teal inline-flex mb-4">สำเร็จ</div>
          <h1 className="font-slab text-lg mb-2">เปลี่ยน PIN เรียบร้อย</h1>
          <p className="text-sm text-inkSoft mb-5">ใช้ PIN ใหม่ในการเข้าสู่ระบบครั้งถัดไป</p>
          <button
            onClick={() => navigate("/")}
            className="bg-teal text-white rounded px-5 py-2.5 text-sm font-medium"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-sm mx-auto bg-white border border-paperLine rounded-lg p-6 receipt-edge text-center">
        <h1 className="font-slab text-lg mb-1">เปลี่ยน PIN</h1>
        <p className="text-sm text-inkSoft mb-5">{profile?.name}</p>

        {step === 1 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">พิมพ์ PIN ปัจจุบันเพื่อยืนยันตัวตน</p>
            <PinPad value={currentPin} onChange={setCurrentPin} maxLength={6} disabled={busy} />
            {error && <p className="text-sm text-rust mt-3">{error}</p>}
            <button
              onClick={verifyCurrentPin}
              disabled={busy || currentPin.length < 4}
              className="w-full bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark disabled:opacity-40 mt-4"
            >
              {busy ? "กำลังตรวจสอบ..." : "ถัดไป"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">ตั้ง PIN ใหม่ (4-6 หลัก)</p>
            <PinPad value={newPin} onChange={setNewPin} maxLength={6} />
            {error && <p className="text-sm text-rust mt-3">{error}</p>}
            <button
              onClick={goConfirmStep}
              disabled={newPin.length < 4}
              className="w-full bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark disabled:opacity-40 mt-4"
            >
              ถัดไป
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">พิมพ์ PIN ใหม่อีกครั้งเพื่อยืนยัน</p>
            <PinPad value={newPinConfirm} onChange={setNewPinConfirm} maxLength={newPin.length} disabled={busy} />
            {error && <p className="text-sm text-rust mt-3">{error}</p>}
            <button
              onClick={finish}
              disabled={busy || newPinConfirm.length < newPin.length}
              className="w-full bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark disabled:opacity-40 mt-4"
            >
              {busy ? "กำลังบันทึก..." : "ยืนยันเปลี่ยน PIN"}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
