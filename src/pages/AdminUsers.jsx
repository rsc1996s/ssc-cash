import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import PinPad from "../components/PinPad";
import { createAccountWithoutSigningIn } from "../lib/createAccount";
import { pinToPassword, randomPinEmail, PIN_PATTERN } from "../lib/auth";

const ROLE_LABEL = {
  staff: "พนักงาน",
  guest: "ผู้อ่าน (Guest)",
  owner: "เจ้าของ/ผู้จัดการ",
};

function AddEmployeeForm({ onClose }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: ชื่อ+บทบาท, 2: ตั้ง PIN, 3: ยืนยัน PIN
  const [name, setName] = useState("");
  const [role, setRole] = useState("staff");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      // สร้างบัญชีผ่าน Firebase App สำรอง เพื่อไม่ให้เจ้าของร้านหลุดออกจากระบบตัวเอง
      const newUid = await createAccountWithoutSigningIn(email, pinToPassword(pin));

      await setDoc(doc(db, "users", newUid), {
        name: name.trim(),
        pin,
        role,
        createdAt: serverTimestamp(),
        createdByOwner: user.uid,
      });
      await setDoc(doc(db, "pinDirectory", pin), { uid: newUid, email });

      onClose(true);
    } catch (err) {
      console.error(err);
      setError("เพิ่มพนักงานไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-paperLine rounded-lg p-5 receipt-edge mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-slab text-base">เพิ่มพนักงาน / ผู้อ่านใหม่</h2>
        <button onClick={() => onClose(false)} className="text-xs text-inkSoft">
          ยกเลิก
        </button>
      </div>

      {step === 1 && (
        <form onSubmit={goToPinStep} className="space-y-3 max-w-sm">
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
          <div>
            <label className="text-sm text-inkSoft block mb-1">บทบาท</label>
            <div className="flex gap-2">
              {["staff", "guest", "owner"].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded border text-sm font-medium ${
                    role === r ? "bg-ink text-white border-ink" : "border-paperLine text-inkSoft"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            className="bg-teal text-white rounded px-5 py-2 text-sm font-medium"
          >
            ถัดไป
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="max-w-sm">
          <p className="text-sm text-inkSoft mb-3 text-center">ตั้ง PIN ให้ {name} (4-6 หลัก)</p>
          <PinPad value={pin} onChange={setPin} maxLength={6} />
          {error && <p className="text-sm text-rust mt-3 text-center">{error}</p>}
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
              className="flex-1 bg-teal text-white rounded py-2.5 text-sm font-medium disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-sm">
          <p className="text-sm text-inkSoft mb-3 text-center">พิมพ์ PIN อีกครั้งเพื่อยืนยัน</p>
          <PinPad value={pinConfirm} onChange={setPinConfirm} maxLength={pin.length} disabled={busy} />
          {error && <p className="text-sm text-rust mt-3 text-center">{error}</p>}
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
              className="flex-1 bg-teal text-white rounded py-2.5 text-sm font-medium disabled:opacity-40"
            >
              {busy ? "กำลังบันทึก..." : "ยืนยันเพิ่มพนักงาน"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  async function setRole(uid, role) {
    setBusyId(uid);
    try {
      await updateDoc(doc(db, "users", uid), { role });
    } finally {
      setBusyId(null);
    }
  }

  const pending = users.filter((u) => u.role === "pending");
  const approved = users.filter((u) => u.role !== "pending");

  return (
    <Layout>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="font-slab text-lg">จัดการผู้ใช้งาน</h1>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm bg-teal text-white rounded px-3 py-1.5 font-medium"
          >
            + เพิ่มพนักงาน
          </button>
        )}
      </div>
      <p className="text-sm text-inkSoft mb-4">
        เพิ่มพนักงาน/ผู้อ่านจากปุ่มด้านบนได้เลย (เข้าใช้งานได้ทันที ไม่ต้องรออนุมัติ) หรือปล่อยให้แต่ละคนสมัครเอง
        แล้วมาอนุมัติทีหลังก็ได้ — แต่ละคนเปลี่ยน PIN ของตัวเองได้จากเมนู "เปลี่ยน PIN" หลังล็อกอินเสมอ
        เจ้าของร้านไม่สามารถแก้ PIN แทนคนอื่นได้โดยตรง
      </p>

      {showAddForm && (
        <AddEmployeeForm
          onClose={() => {
            setShowAddForm(false);
          }}
        />
      )}

      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-amber mb-2">รออนุมัติ ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="bg-white border border-paperLine rounded-lg p-4 flex items-center justify-between flex-wrap gap-2 receipt-edge"
              >
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-inkSoft font-nums">PIN: {u.pin || "-"}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    disabled={busyId === u.id}
                    onClick={() => setRole(u.id, "staff")}
                    className="text-xs bg-teal text-white rounded px-3 py-1.5 font-medium"
                  >
                    อนุมัติเป็นพนักงาน
                  </button>
                  <button
                    disabled={busyId === u.id}
                    onClick={() => setRole(u.id, "guest")}
                    className="text-xs border border-paperLine rounded px-3 py-1.5"
                  >
                    ตั้งเป็นผู้อ่าน
                  </button>
                  <button
                    disabled={busyId === u.id}
                    onClick={() => setRole(u.id, "owner")}
                    className="text-xs border border-paperLine rounded px-3 py-1.5"
                  >
                    ตั้งเป็นเจ้าของ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm font-medium text-inkSoft mb-2">ผู้ใช้งานทั้งหมด</h2>
      <div className="space-y-2">
        {approved.map((u) => (
          <div
            key={u.id}
            className="bg-white border border-paperLine rounded-lg p-4 flex items-center justify-between receipt-edge"
          >
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-inkSoft font-nums">PIN: {u.pin || "-"}</div>
            </div>
            <select
              value={u.role}
              onChange={(e) => setRole(u.id, e.target.value)}
              disabled={busyId === u.id}
              className="text-xs border border-paperLine rounded px-2 py-1.5"
            >
              <option value="staff">พนักงาน</option>
              <option value="guest">ผู้อ่าน (Guest)</option>
              <option value="owner">เจ้าของ/ผู้จัดการ</option>
            </select>
          </div>
        ))}
      </div>
    </Layout>
  );
}
