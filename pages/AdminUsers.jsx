import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import PinPad from "../components/PinPad";
import { createAccountWithoutSigningIn, deleteAccountWithoutSigningIn } from "../lib/createAccount";
import {
  pinToPassword,
  randomPinEmail,
  PIN_PATTERN,
  normalizeUsername,
  USERNAME_PATTERN,
} from "../lib/auth";
import { newAuditEvent, queueAuditEvent } from "../lib/audit";
import Sheet from "../components/ui/Sheet";
import FormHeader from "../components/ui/FormHeader";
import { useFeedback } from "../components/ui/FeedbackProvider";
import PageHeader from "../components/ui/PageHeader";
import Input from "../components/ui/Input";
import SearchPicker from "../components/ui/SearchPicker";
import { normalizeSearchText } from "../components/ui/searchText";
import useScopedCashData from "../hooks/useScopedCashData";

const ROLE_OPTIONS = [
  { value: "staff", label: "พนักงาน" },
  { value: "guest", label: "ผู้อ่าน (Guest)" },
  { value: "owner", label: "เจ้าของ/ผู้จัดการ" },
];

function AddEmployeeForm({ open, onClose, funds, fundsLoading, fundsError }) {
  const { user } = useAuth();
  const { confirm, toast } = useFeedback();
  const [step, setStep] = useState(1); // 1: ชื่อ+บทบาท, 2: ตั้ง PIN, 3: ยืนยัน PIN
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("staff");
  const [fundIds, setFundIds] = useState([]);
  const [fundsChosen, setFundsChosen] = useState(false);
  const [roleLabel, setRoleLabel] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function goToPinStep(e) {
    e?.preventDefault();
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    if (!USERNAME_PATTERN.test(normalizeUsername(username))) {
      setError("ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข 3-24 ตัว และขึ้นต้นด้วยตัวอักษร");
      return;
    }
    if (role !== "owner" && (!fundsChosen || fundsLoading || fundsError)) {
      setError("กรุณาเลือกงบที่ดูแล หรือกดล้างเพื่อระบุว่าไม่เห็นงบใด");
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
    let newUid = null;
    const email = randomPinEmail();
    try {
      const normalizedUsername = normalizeUsername(username);
      const usernameRef = doc(db, "pinDirectory", normalizedUsername);
      const existing = await getDoc(usernameRef);
      if (existing.exists()) {
        setError("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น");
        return;
      }

      // สร้างบัญชีผ่าน Firebase App สำรอง เพื่อไม่ให้เจ้าของร้านหลุดออกจากระบบตัวเอง
      newUid = await createAccountWithoutSigningIn(email, pinToPassword(pin));
      const setupRef = doc(db, "meta", "setup");
      const setupSnap = await getDoc(setupRef);
      const setup = setupSnap.data();
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: user.displayName || "",
        action: "user-created",
        targetCollection: "users",
        targetId: newUid,
        before: null,
        after: role === "owner" ? { role, disabled: false } : { role, disabled: false, fundIds, roleLabel },
      });
      const batch = writeBatch(db);
      batch.set(doc(db, "users", newUid), {
        name: name.trim(),
        username: normalizedUsername,
        role,
        disabled: false,
        createdAt: serverTimestamp(),
        createdByOwner: user.uid,
        auditLogId: audit.ref.id,
        ...(role === "owner" ? {} : { fundIds, roleLabel }),
      });
      batch.set(usernameRef, { uid: newUid, email });
      queueAuditEvent(batch, audit);
      if (role === "owner") {
        if (!Number.isInteger(setup?.ownerCount)) {
          throw new Error("กรุณาเตรียมจำนวนเจ้าของร้านก่อนเพิ่ม owner");
        }
        batch.update(setupRef, {
          ownerCount: setup.ownerCount + 1,
          ownerChangeUserId: newUid,
        });
      }
      await batch.commit();
      toast("เพิ่มผู้ใช้แล้ว");
      setStep(1);
      setName("");
      setUsername("");
      setFundIds([]);
      setFundsChosen(false);
      setRoleLabel("");
      setPin("");
      setPinConfirm("");
      onClose(true);
    } catch (err) {
      console.error(err);
      setError("เพิ่มพนักงานไม่สำเร็จ ลองใหม่อีกครั้ง");
      if (newUid) {
        try {
          const savedProfile = await getDoc(doc(db, "users", newUid));
          if (!savedProfile.exists()) {
            await deleteAccountWithoutSigningIn(email, pinToPassword(pin));
          } else {
            setError("ข้อมูลผู้ใช้ถูกบันทึกแล้ว แต่ยืนยันผลไม่สำเร็จ กรุณาตรวจสอบรายชื่อผู้ใช้ก่อนลองซ้ำ");
          }
        } catch (cleanupError) {
          console.error(cleanupError);
          setError("บันทึกข้อมูลไม่สำเร็จ และลบบัญชี Auth ที่สร้างค้างไว้ไม่ได้ กรุณาตรวจสอบ Firebase Auth");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelForm() {
    if ((name || username || pin || pinConfirm || fundsChosen || roleLabel) && !await confirm({
      title: "ยกเลิกการเพิ่มผู้ใช้",
      description: "ข้อมูลผู้ใช้ที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setStep(1);
    setName("");
    setUsername("");
    setRole("staff");
    setFundIds([]);
    setFundsChosen(false);
    setRoleLabel("");
    setPin("");
    setPinConfirm("");
    setError("");
    onClose(false);
  }

  return (
    <Sheet
      open={open}
      title="เพิ่มผู้ใช้"
      onClose={cancelForm}
      header={
        <FormHeader
          title="เพิ่มพนักงาน / ผู้อ่าน"
          onCancel={cancelForm}
          onSave={() => {
            if (step === 1) goToPinStep();
            else if (step === 2) confirmFirstPin();
            else finish();
          }}
          saving={busy}
          saveDisabled={step === 3 && pinConfirm.length < pin.length}
          saveLabel={step === 3 ? "บันทึก" : "ถัดไป"}
        />
      }
    >

      {step === 1 && (
        <form onSubmit={goToPinStep} className="space-y-3 max-w-sm">
          <div>
            <label className="text-sm text-inkSoft block mb-1">ชื่อ-นามสกุล</label>
            <Input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="employee-username" className="text-sm text-inkSoft block mb-1">
              ชื่อผู้ใช้ (ภาษาอังกฤษ/ตัวเลข)
            </label>
            <Input
              id="employee-username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">บทบาท</label>
            <div className="flex gap-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`flex-1 py-2 rounded border text-sm font-medium ${
                    role === r.value ? "bg-blue-600 text-white border-blue-600" : "border-paperLine text-inkSoft"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {role !== "owner" && (
              <>
                <div>
                  <label className="text-sm text-inkSoft block mb-1">งบที่ดูแล (ต้องเลือกให้ชัดเจน)</label>
                  <SearchPicker multiple maxSelected={30} value={fundIds}
                    onChange={(ids) => { setFundIds(ids); setFundsChosen(true); }}
                    options={funds.map((fund) => ({ value: fund.id, label: fund.label }))}
                    disabled={fundsLoading || Boolean(fundsError)}
                    ariaLabel="เลือกงบที่ดูแล" placeholder="เลือกงบ หรือกดล้างหากไม่ให้เห็นงบใด" />
                  {fundsChosen && fundIds.length === 0 && <p className="mt-1 text-xs text-inkSoft">ไม่เห็นงบใด</p>}
                  {fundsError && <p role="alert" className="text-sm text-danger">โหลดรายชื่องบไม่สำเร็จ</p>}
                </div>
                <div>
                  <label className="text-sm text-inkSoft block mb-1">ชื่อบทบาท (ไม่บังคับ)</label>
                  <Input value={roleLabel} maxLength={100} onChange={(event) => setRoleLabel(event.target.value)} />
                </div>
              </>
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      )}

      {step === 2 && (
        <div className="max-w-sm">
          <p className="text-sm text-inkSoft mb-3 text-center">ตั้ง PIN ให้ {name} (6 หลัก)</p>
          <PinPad value={pin} onChange={setPin} maxLength={6} />
          {error && <p className="text-sm text-danger mt-3 text-center">{error}</p>}
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
        <div className="max-w-sm">
          <p className="text-sm text-inkSoft mb-3 text-center">พิมพ์ PIN อีกครั้งเพื่อยืนยัน</p>
          <PinPad value={pinConfirm} onChange={setPinConfirm} maxLength={pin.length} disabled={busy} />
          {error && <p className="text-sm text-danger mt-3 text-center">{error}</p>}
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
    </Sheet>
  );
}

export default function AdminUsers() {
  const { user, profile: currentProfile } = useAuth();
  const { confirm, toast } = useFeedback();
  const { funds, loading: fundsLoading, error: fundsError } = useScopedCashData();
  const [users, setUsers] = useState([]);
  const [setup, setSetup] = useState(null);
  const [usernameDrafts, setUsernameDrafts] = useState({});
  const [pageError, setPageError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [userSection, setUserSection] = useState("pending");
  const [listOpen, setListOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationSearch, setMigrationSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [accessUser, setAccessUser] = useState(null);
  const [accessFunds, setAccessFunds] = useState([]);
  const [accessChosen, setAccessChosen] = useState(false);
  const [accessLabel, setAccessLabel] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubSetup = onSnapshot(doc(db, "meta", "setup"), (snap) => {
      setSetup(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return () => {
      unsub();
      unsubSetup();
    };
  }, []);

  const migrationMode = setup && setup.loginMode !== "username";
  const activeOwnerCount = users.filter((u) => u.role === "owner" && u.disabled !== true).length;

  async function initializeOwnerCount() {
    setBusy(true);
    setPageError("");
    try {
      await updateDoc(doc(db, "meta", "setup"), { ownerCount: activeOwnerCount });
    } catch (err) {
      console.error(err);
      setPageError("เตรียมจำนวนเจ้าของร้านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function migrateUsername(profile) {
    setBusyId(profile.id);
    setPageError("");
    const username = normalizeUsername(usernameDrafts[profile.id] || "");
    try {
      if (!USERNAME_PATTERN.test(username)) {
        throw new Error("ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข 3-24 ตัว และขึ้นต้นด้วยตัวอักษร");
      }
      if (!profile.pin) {
        throw new Error("ไม่พบข้อมูล PIN เดิมสำหรับย้าย mapping นี้");
      }
      const oldRef = doc(db, "pinDirectory", profile.pin);
      const newRef = doc(db, "pinDirectory", username);
      const [oldSnap, newSnap] = await Promise.all([getDoc(oldRef), getDoc(newRef)]);
      if (!oldSnap.exists() || oldSnap.data().uid !== profile.id) {
        throw new Error("mapping PIN เดิมไม่ตรงกับบัญชีนี้ กรุณาตรวจสอบก่อนย้าย");
      }
      if (newSnap.exists()) {
        throw new Error("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น");
      }

      const batch = writeBatch(db);
      batch.update(doc(db, "users", profile.id), {
        username,
        pin: deleteField(),
      });
      batch.set(newRef, { uid: profile.id, email: oldSnap.data().email });
      batch.delete(oldRef);
      await batch.commit();
      setUsernameDrafts((drafts) => ({ ...drafts, [profile.id]: "" }));
    } catch (err) {
      console.error(err);
      setPageError(err.message || "ย้ายชื่อผู้ใช้ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function finishUsernameMigration() {
    if (users.some((profile) => !profile.username || profile.pin)) {
      setPageError("ต้องกำหนดชื่อผู้ใช้และย้าย PIN ของทุกบัญชีก่อน");
      return;
    }
    if (!Number.isInteger(setup?.ownerCount)) {
      setPageError("กรุณาเตรียมจำนวนเจ้าของร้านก่อนเปิดใช้");
      return;
    }
    setBusy(true);
    setPageError("");
    try {
      await updateDoc(doc(db, "meta", "setup"), {
        loginMode: "username",
        ownerCount: Number.isInteger(setup?.ownerCount) ? setup.ownerCount : activeOwnerCount,
        loginModeUpdatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setPageError("เปิดใช้การเข้าสู่ระบบด้วยชื่อผู้ใช้ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function changeUser(uid, changes, action) {
    setBusyId(uid);
    setPageError("");
    try {
      if (uid === user.uid) {
        throw new Error("เจ้าของร้านไม่สามารถเปลี่ยนบทบาทหรือปิดใช้งานบัญชีตัวเองได้");
      }
      const target = users.find((profile) => profile.id === uid);
      if (!target) throw new Error("ไม่พบบัญชีผู้ใช้");
      const nextRole = changes.role ?? target.role;
      const nextDisabled = changes.disabled ?? (target.disabled === true);
      const wasActiveOwner = target.role === "owner" && target.disabled !== true;
      const willBeActiveOwner = nextRole === "owner" && !nextDisabled;
      const ownerDelta = Number(willBeActiveOwner) - Number(wasActiveOwner);
      if (ownerDelta < 0 && activeOwnerCount <= 1) {
        throw new Error("ไม่สามารถลดสิทธิ์หรือปิดใช้งานเจ้าของร้านคนสุดท้ายได้");
      }
      if (ownerDelta !== 0 && !Number.isInteger(setup?.ownerCount)) {
        throw new Error("กรุณาเตรียมจำนวนเจ้าของร้านก่อนเปลี่ยนสิทธิ์");
      }

      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: user.displayName || "",
        action,
        targetCollection: "users",
        targetId: uid,
        before: { role: target.role, disabled: target.disabled === true },
        after: { role: nextRole, disabled: nextDisabled },
      });
      const batch = writeBatch(db);
      batch.update(doc(db, "users", uid), {
        role: nextRole,
        disabled: nextDisabled,
        auditLogId: audit.ref.id,
      });
      queueAuditEvent(batch, audit);
      if (ownerDelta !== 0) {
        batch.update(doc(db, "meta", "setup"), {
          ownerCount: setup.ownerCount + ownerDelta,
          ownerChangeUserId: uid,
        });
      }
      await batch.commit();
    } catch (err) {
      console.error(err);
      setPageError(err.message || "บันทึกสิทธิ์ผู้ใช้ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function setRole(uid, role) {
    return changeUser(uid, { role }, "role-changed");
  }

  async function setDisabled(profile, disabled) {
    return changeUser(profile.id, { disabled }, disabled ? "user-disabled" : "user-enabled");
  }

  function openAccess(target) {
    setAccessUser(target);
    setAccessFunds(Array.isArray(target.fundIds) ? target.fundIds : []);
    setAccessChosen(Array.isArray(target.fundIds));
    setAccessLabel(target.roleLabel || "");
    setPageError("");
  }

  async function cancelAccess() {
    if (accessBusy || !accessUser) return;
    const oldFunds = Array.isArray(accessUser.fundIds) ? accessUser.fundIds : [];
    const changed = accessChosen !== Array.isArray(accessUser.fundIds) ||
      JSON.stringify(accessFunds) !== JSON.stringify(oldFunds) ||
      accessLabel !== (accessUser.roleLabel || "");
    if (changed && !await confirm({
      title: "ยกเลิกการกำหนดงบ",
      description: "ข้อมูลที่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setPageError("");
    setAccessUser(null);
  }

  async function saveAccess() {
    if (!accessUser || !accessChosen || fundsLoading || fundsError) {
      setPageError("กรุณาเลือกงบที่ดูแล หรือกดล้างเพื่อระบุว่าไม่เห็นงบใด");
      return;
    }
    const oldIds = Array.isArray(accessUser.fundIds) ? accessUser.fundIds : funds.map((fund) => fund.id);
    const nameFor = (id) => funds.find((fund) => fund.id === id)?.label || id;
    const added = accessFunds.filter((id) => !oldIds.includes(id)).map(nameFor);
    const removed = oldIds.filter((id) => !accessFunds.includes(id)).map(nameFor);
    const before = { fundIds: accessUser.fundIds ?? null, roleLabel: accessUser.roleLabel ?? null };
    const after = { fundIds: accessFunds, roleLabel: accessLabel };
    if (JSON.stringify(before) === JSON.stringify(after)) {
      setAccessUser(null);
      return;
    }
    if (!await confirm({
      title: `ยืนยันสิทธิ์ของ ${accessUser.name || accessUser.id}`,
      description: `เพิ่ม: ${added.join(", ") || "ไม่มี"} · เลิกดู: ${removed.join(", ") || "ไม่มี"} · ชื่อบทบาท: ${accessLabel || "ไม่ระบุ"}`,
      confirmLabel: "บันทึกสิทธิ์",
      cancelLabel: "กลับไปแก้ไข",
    })) return;
    setAccessBusy(true);
    setPageError("");
    try {
      const audit = newAuditEvent({
        actorUid: user.uid,
        actorName: currentProfile?.name || user.displayName || "",
        action: "user-access-changed",
        targetCollection: "users",
        targetId: accessUser.id,
        before,
        after,
      });
      const batch = writeBatch(db);
      batch.update(doc(db, "users", accessUser.id), { ...after, auditLogId: audit.ref.id });
      queueAuditEvent(batch, audit);
      await batch.commit();
      toast("บันทึกงบที่ดูแลแล้ว");
      setAccessUser(null);
    } catch (error) {
      console.error("บันทึกสิทธิ์งบไม่สำเร็จ:", error);
      setPageError("บันทึกสิทธิ์งบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และลองใหม่");
    } finally {
      setAccessBusy(false);
    }
  }

  const matchesSearch = (u) => normalizeSearchText(`${u.name || ""} ${u.username || ""}`).includes(normalizeSearchText(search));
  const pending = users.filter((u) => u.role === "pending" && matchesSearch(u));
  const approved = users.filter((u) =>
    (userSection === "owners" ? u.role === "owner" : ["staff", "guest"].includes(u.role)) && matchesSearch(u));

  return (
    <Layout>
      <PageHeader
        title="จัดการผู้ใช้งาน"
        fallbackTo="/settings"
        right={!showAddForm && setup?.loginMode === "username" && Number.isInteger(setup?.ownerCount) ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="min-h-11 rounded-lg bg-primary px-3 text-sm font-medium text-white"
          >
            + เพิ่ม
          </button>
        ) : null}
      />
      <p className="text-sm text-inkSoft mb-4">
        ผู้ใช้เข้าสู่ระบบด้วยชื่อผู้ใช้และ PIN; ระบบไม่เก็บหรือแสดง PIN ในโปรไฟล์
      </p>

      {migrationMode && (
        <button type="button" onClick={() => setMigrationOpen(true)} className="mb-4 flex min-h-14 w-full items-center justify-between rounded-lg border border-warning/40 bg-warning-light px-4 text-left">
          <span>ย้ายบัญชีไปใช้ชื่อผู้ใช้</span><span>›</span>
        </button>
      )}
      <Sheet open={Boolean(migrationMode) && migrationOpen} title="ย้ายบัญชีไปใช้ชื่อผู้ใช้" onClose={() => setMigrationOpen(false)}>
      <Input value={migrationSearch} onChange={(event) => setMigrationSearch(event.target.value)} placeholder="ค้นหาผู้ใช้" aria-label="ค้นหาผู้ใช้ที่ต้องย้าย" className="mb-4 w-full" />
      {pageError && <p role="alert" className="mb-3 text-sm text-danger">{pageError}</p>}
      {migrationMode && (
        <section className="bg-warning-light border border-warning/40 rounded-lg p-4 mb-6">
          <h2 className="font-medium mb-1">ย้ายบัญชีไปใช้ชื่อผู้ใช้</h2>
          <p className="text-sm text-inkSoft mb-3">
            กำหนดชื่อผู้ใช้ให้ทุกบัญชีก่อนเปิดวิธีเข้าสู่ระบบใหม่; mapping และ PIN เดิมจะถูกย้าย/ลบในรายการเดียวกัน
          </p>
          {!Number.isInteger(setup?.ownerCount) && (
            <button
              onClick={initializeOwnerCount}
              disabled={busy}
              className="text-sm border border-paperLine rounded px-3 py-1.5 mb-3"
            >
              เตรียมจำนวนเจ้าของร้าน ({activeOwnerCount})
            </button>
          )}
          <div className="space-y-2">
            {users.filter((profile) => (!profile.username || profile.pin) &&
              normalizeSearchText(`${profile.name || ""} ${profile.username || ""}`).includes(normalizeSearchText(migrationSearch))).map((profile) => (
              <div key={profile.id} className="flex flex-wrap items-center gap-2">
                <span className="text-sm flex-1 min-w-32">{profile.name || profile.id}</span>
                <Input
                  aria-label={`ชื่อผู้ใช้สำหรับ ${profile.name || profile.id}`}
                  value={usernameDrafts[profile.id] || ""}
                  onChange={(e) => setUsernameDrafts((drafts) => ({ ...drafts, [profile.id]: e.target.value }))}
                  placeholder="username"
                  className="border border-paperLine rounded px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => migrateUsername(profile)}
                  disabled={busyId === profile.id}
                  className="bg-primary text-white rounded px-3 py-1.5 text-sm"
                >
                  {busyId === profile.id ? "กำลังย้าย..." : "ย้ายบัญชี"}
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={finishUsernameMigration}
            disabled={busy || users.length === 0 || users.some((profile) => !profile.username || profile.pin)}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm mt-4 disabled:opacity-50"
          >
            {busy ? "กำลังเปิดใช้..." : "เปิดใช้ชื่อผู้ใช้ + PIN"}
          </button>
        </section>
      )}
      </Sheet>

      {pageError && <p className="text-sm text-danger mb-3">{pageError}</p>}

      {setup?.loginMode === "username" && (
        <AddEmployeeForm
          open={showAddForm}
          funds={funds}
          fundsLoading={fundsLoading}
          fundsError={fundsError}
          onClose={() => {
            setShowAddForm(false);
          }}
        />
      )}

      <div className="space-y-2">
        {[
          { value: "pending", label: "รออนุมัติ", count: users.filter((u) => u.role === "pending").length },
          { value: "staff", label: "พนักงานและผู้อ่าน", count: users.filter((u) => ["staff", "guest"].includes(u.role)).length },
          { value: "owners", label: "แอดมิน", count: users.filter((u) => u.role === "owner").length },
        ].map((group) => (
          <button key={group.value} type="button" className="flex min-h-14 w-full items-center justify-between rounded-lg border border-paperLine bg-white px-4 text-left"
            onClick={() => { setUserSection(group.value); setSearch(""); setVisibleCount(10); setListOpen(true); }}>
            <span>{group.label}</span><span className="text-sm text-inkSoft">{group.count} คน ›</span>
          </button>
        ))}
      </div>
      <Sheet open={listOpen} title={userSection === "pending" ? "รออนุมัติ" : userSection === "owners" ? "แอดมิน" : "พนักงานและผู้อ่าน"} onClose={() => setListOpen(false)}>
      <Input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(10); }} placeholder="ค้นหาชื่อหรือชื่อผู้ใช้" aria-label="ค้นหาผู้ใช้" className="mb-4 w-full" />
      {userSection === "pending" && pending.length > 0 && (
        <div className="mb-6">
          <div className="space-y-2">
            {pending.slice(0, visibleCount).map((u) => (
              <div
                key={u.id}
                className="bg-white border border-paperLine rounded-lg p-4 flex items-center justify-between flex-wrap gap-2"
              >
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-inkSoft">{u.username || "ยังไม่มีชื่อผู้ใช้"}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    disabled={busyId === u.id}
                    onClick={() => setRole(u.id, "staff")}
                    className="text-xs bg-primary text-white rounded px-3 py-1.5 font-medium"
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
                  <button
                    disabled={busyId === u.id || u.id === user.uid}
                    onClick={() => setDisabled(u, u.disabled !== true)}
                    className="text-xs border border-danger text-danger rounded px-3 py-1.5"
                  >
                    {u.disabled === true ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pending.length > visibleCount && (
            <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="mt-3 w-full rounded-lg border border-paperLine bg-white py-3 text-sm text-blue-700">
              ดูเพิ่มเติม ({pending.length - visibleCount})
            </button>
          )}
        </div>
      )}
      {userSection === "pending" && pending.length === 0 && (
        <p className="rounded-lg border border-dashed border-paperLine bg-white p-4 text-sm text-inkSoft">
          ไม่มีผู้ใช้ที่รออนุมัติ
        </p>
      )}

      {userSection !== "pending" && <div className="space-y-2">
        {approved.length === 0 && <p className="text-sm text-inkSoft">ไม่พบผู้ใช้งาน</p>}
        {approved.slice(0, visibleCount).map((u) => (
          <div
            key={u.id}
            className="bg-white border border-paperLine rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-inkSoft">{u.username || "ยังไม่มีชื่อผู้ใช้"}</div>
              {["staff", "guest"].includes(u.role) && (
                <div className="mt-1 text-xs text-inkSoft">
                  งบที่ดูแล: {!Object.hasOwn(u, "fundIds") ? "ยังไม่ได้กำหนด (ทุกงบ)" :
                    Array.isArray(u.fundIds) ? (u.fundIds.map((id) => funds.find((fund) => fund.id === id)?.label || id).join(", ") || "ไม่มีงบ") : "ข้อมูลไม่ถูกต้อง"}
                  {u.roleLabel && ` · ${u.roleLabel}`}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {["staff", "guest"].includes(u.role) && u.id !== user.uid && (
                <button type="button" onClick={() => openAccess(u)} className="min-h-11 rounded-lg border border-paperLine px-3 text-sm">
                  กำหนดงบ
                </button>
              )}
              <SearchPicker
                ariaLabel={`บทบาท ${u.name}`}
                value={u.role}
                onChange={(role) => setRole(u.id, role)}
                options={ROLE_OPTIONS}
                disabled={busyId === u.id || u.id === user.uid || migrationMode || !Number.isInteger(setup?.ownerCount)}
                className="w-44"
              />
              <button
                onClick={() => setDisabled(u, u.disabled !== true)}
                disabled={busyId === u.id || u.id === user.uid || migrationMode || !Number.isInteger(setup?.ownerCount)}
                className={`text-xs rounded px-3 py-1.5 ${
                  u.disabled === true ? "bg-primary text-white" : "border border-danger text-danger"
                }`}
              >
                {u.disabled === true ? "เปิดใช้งาน" : "ปิดใช้งาน"}
              </button>
            </div>
          </div>
        ))}
        {approved.length > visibleCount && (
          <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="w-full rounded-lg border border-paperLine bg-white py-3 text-sm text-blue-700">
            ดูเพิ่มเติม ({approved.length - visibleCount})
          </button>
        )}
      </div>}
      </Sheet>
      <Sheet open={Boolean(accessUser)} title="กำหนดงบที่ดูแล" onClose={cancelAccess}
        header={<FormHeader title="กำหนดงบที่ดูแล" onCancel={cancelAccess} onSave={saveAccess} saving={accessBusy} />}>
        <div className="space-y-4">
          <p className="font-medium">{accessUser?.name || accessUser?.id}</p>
          {accessUser && !Object.hasOwn(accessUser, "fundIds") && <p className="text-sm text-inkSoft">ปัจจุบัน: ยังไม่ได้กำหนด (ทุกงบ)</p>}
          <SearchPicker multiple maxSelected={30} value={accessFunds}
            onChange={(ids) => { setAccessFunds(ids); setAccessChosen(true); }}
            options={funds.map((fund) => ({ value: fund.id, label: fund.label }))}
            disabled={fundsLoading || Boolean(fundsError)} ariaLabel="งบที่ดูแล"
            placeholder="เลือกงบ หรือกดล้างหากไม่ให้เห็นงบใด" />
          {accessChosen && accessFunds.length === 0 && <p className="text-sm text-inkSoft">ไม่เห็นงบใด</p>}
          <label className="block text-sm text-inkSoft">ชื่อบทบาท (ไม่บังคับ)
            <Input value={accessLabel} maxLength={100} onChange={(event) => setAccessLabel(event.target.value)} />
          </label>
          {pageError && <p role="alert" className="text-sm text-danger">{pageError}</p>}
        </div>
      </Sheet>
    </Layout>
  );
}
