import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { pinToPassword, randomPinEmail, PIN_PATTERN, normalizeUsername, USERNAME_PATTERN } from "../lib/auth";
import PinPad from "../components/PinPad";
import FormHeader from "../components/ui/FormHeader";
import { useFeedback } from "../components/ui/FeedbackProvider";
import Input from "../components/ui/Input";

export default function Register() {
  const [step, setStep] = useState(1); // 1: ชื่อ, 2: ตั้ง PIN, 3: ยืนยัน PIN
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();

  function goToPinStep(e) {
    e?.preventDefault();
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      document.querySelector('input[autocomplete="name"]')?.focus();
      return;
    }
    if (!USERNAME_PATTERN.test(normalizeUsername(username))) {
      setError("ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข 3-24 ตัว และขึ้นต้นด้วยตัวอักษร");
      document.getElementById("register-username")?.focus();
      return;
    }
    setError("");
    setStep(2);
  }

  function confirmFirstPin() {
    if (!PIN_PATTERN.test(pin)) {
      setError("PIN ต้องเป็นตัวเลข 6 หลัก");
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
    let createdUser = null;
    try {
      const normalizedUsername = normalizeUsername(username);
      if (!USERNAME_PATTERN.test(normalizedUsername)) {
        setError("ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข 3-24 ตัว และขึ้นต้นด้วยตัวอักษร");
        return;
      }

      const usernameRef = doc(db, "pinDirectory", normalizedUsername);
      const setupRef = doc(db, "meta", "setup");
      const [existingUsername, setupSnap] = await Promise.all([
        getDoc(usernameRef),
        getDoc(setupRef),
      ]);
      if (existingUsername.exists()) {
        setError("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น");
        return;
      }

      if (setupSnap.exists() && setupSnap.data().loginMode !== "username") {
        setError("เจ้าของร้านกำลังย้ายข้อมูลเข้าสู่ระบบ กรุณาลองใหม่ภายหลัง");
        return;
      }

      const isFirstEverUser = !setupSnap.exists();

      const email = randomPinEmail();
      const cred = await createUserWithEmailAndPassword(auth, email, pinToPassword(pin));
      createdUser = cred.user;

      const batch = writeBatch(db);
      batch.set(doc(db, "users", cred.user.uid), {
        name: name.trim(),
        username: normalizedUsername,
        role: isFirstEverUser ? "owner" : "pending",
        createdAt: serverTimestamp(),
      });
      batch.set(usernameRef, { uid: cred.user.uid, email });
      if (isFirstEverUser) {
        batch.set(setupRef, {
          ownerBootstrappedAt: serverTimestamp(),
          ownerUid: cred.user.uid,
          ownerCount: 1,
          loginMode: "username",
        });
      }
      await batch.commit();
      createdUser = null;

      toast("สมัครใช้งานแล้ว");
      navigate(isFirstEverUser ? "/" : "/pending");
    } catch (err) {
      console.error(err);
      let message = "สมัครไม่สำเร็จ ลองใหม่อีกครั้ง";
      if (createdUser) {
        try {
          const savedProfile = await getDoc(doc(db, "users", createdUser.uid));
          if (!savedProfile.exists()) await deleteUser(createdUser);
          else message = "บัญชีถูกสร้างแล้ว แต่ยืนยันผลการสมัครไม่สำเร็จ กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และ PIN";
        } catch (cleanupError) {
          console.error(cleanupError);
          message = "ยืนยันผลการสมัครไม่สำเร็จ กรุณาตรวจสอบบัญชีผู้ใช้ก่อนลองสมัครซ้ำ";
        }
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelRegistration() {
    if ((name || username || pin || pinConfirm) && !await confirm({
      title: "ยกเลิกการลงทะเบียน",
      description: "ข้อมูลที่กรอกไว้แต่ยังไม่ได้ส่งจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white border border-paperLine rounded-lg p-6 text-center">
        <FormHeader
          title={step === 3 ? "ยืนยันการลงทะเบียน" : "ลงทะเบียนพนักงานใหม่"}
          onCancel={cancelRegistration}
          onSave={() => {
            if (step === 1) goToPinStep();
            else if (step === 2) confirmFirstPin();
            else finish();
          }}
          saving={busy}
          saveDisabled={step === 3 && pinConfirm.length < pin.length}
          saveLabel={step === 3 ? "สมัครใช้งาน" : "ถัดไป"}
        />
        <p className="text-sm text-inkSoft mb-5">
          ตั้งชื่อผู้ใช้และ PIN 6 หลักสำหรับเข้าสู่ระบบ ถ้าเป็นคนแรกที่สมัครจะเป็นเจ้าของร้าน
        </p>

        {step === 1 && (
          <form onSubmit={goToPinStep} className="space-y-3 text-left">
            <div>
              <label className="text-sm text-inkSoft block mb-1">ชื่อ-นามสกุล</label>
              <Input
                autoFocus
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="register-username" className="text-sm text-inkSoft block mb-1">
                ชื่อผู้ใช้ (ภาษาอังกฤษ/ตัวเลข)
              </label>
              <Input
                id="register-username"
                autoComplete="username"
                pattern="[A-Za-z][A-Za-z0-9._-]{2,23}"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
              />
              <p className="text-xs text-inkSoft mt-1">3-24 ตัว ขึ้นต้นด้วยตัวอักษร</p>
            </div>
            {error && <p className="text-sm text-rust">{error}</p>}
          </form>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-inkSoft mb-3">ตั้ง PIN สำหรับเข้าสู่ระบบ (6 หลัก)</p>
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
