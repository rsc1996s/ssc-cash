import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import PinPad from "../components/PinPad";
import { pinToPassword, PIN_PATTERN, LEGACY_PIN_PATTERN } from "../lib/auth";
import FormHeader from "../components/ui/FormHeader";
import { useFeedback } from "../components/ui/FeedbackProvider";

export default function ChangePin() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const [step, setStep] = useState(1); // 1: PIN เดิม, 2: PIN ใหม่, 3: ยืนยัน PIN ใหม่
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function verifyCurrentPin() {
    const currentPinPattern = profile?.username ? PIN_PATTERN : LEGACY_PIN_PATTERN;
    if (!currentPinPattern.test(currentPin)) {
      setError(profile?.username ? "PIN ต้องเป็นตัวเลข 6 หลัก" : "PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, pinToPassword(currentPin));
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
      setError("PIN ใหม่ต้องเป็นตัวเลข 6 หลัก");
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
      await updatePassword(auth.currentUser, pinToPassword(newPin));

      toast("เปลี่ยน PIN เรียบร้อย");
      setDone(true);
    } catch (err) {
      console.error(err);
      setError("เปลี่ยน PIN ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function cancelChange() {
    if ((currentPin || newPin || newPinConfirm) && !await confirm({
      title: "ยกเลิกการเปลี่ยน PIN",
      description: "ข้อมูล PIN ที่กรอกไว้จะถูกล้าง",
      confirmLabel: "ออกจากหน้า",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    navigate("/");
  }

  if (done) {
    return (
      <Layout>
        <div className="max-w-sm mx-auto bg-white border border-paperLine rounded-lg p-6 text-center">
          <div className="mb-4 inline-flex rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-800">สำเร็จ</div>
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
      <div className="max-w-sm mx-auto bg-white border border-paperLine rounded-lg p-6 text-center">
        <FormHeader
          title="เปลี่ยน PIN"
          onCancel={cancelChange}
          onSave={() => {
            if (step === 1) verifyCurrentPin();
            else if (step === 2) goConfirmStep();
            else finish();
          }}
          saving={busy}
          saveDisabled={
            (step === 1 && (profile?.username ? currentPin.length !== 6 : currentPin.length < 4)) ||
            (step === 2 && newPin.length < 4) ||
            (step === 3 && newPinConfirm.length < newPin.length)
          }
          saveLabel={step === 1 ? "ตรวจสอบ PIN" : step === 2 ? "ถัดไป" : "บันทึก PIN ใหม่"}
        />
        <p className="text-sm text-inkSoft mb-5">{profile?.name}</p>

        {step === 1 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">พิมพ์ PIN ปัจจุบันเพื่อยืนยันตัวตน</p>
            <PinPad value={currentPin} onChange={setCurrentPin} maxLength={6} disabled={busy} />
            {error && <p className="text-sm text-rust mt-3">{error}</p>}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">ตั้ง PIN ใหม่ (6 หลัก)</p>
            <PinPad value={newPin} onChange={setNewPin} maxLength={6} />
            {error && <p className="text-sm text-rust mt-3">{error}</p>}
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">พิมพ์ PIN ใหม่อีกครั้งเพื่อยืนยัน</p>
            <PinPad value={newPinConfirm} onChange={setNewPinConfirm} maxLength={newPin.length} disabled={busy} />
            {error && <p className="text-sm text-rust mt-3">{error}</p>}
          </div>
        )}
      </div>
    </Layout>
  );
}
