import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { useFeedback } from "../components/ui/FeedbackProvider";
import Sheet from "../components/ui/Sheet";
import FormHeader from "../components/ui/FormHeader";

const emptyAccount = { bankName: "", accountNumber: "", accountName: "", note: "" };

function AccountList({ title, hint, side, accounts }) {
  const { user } = useAuth();
  const { confirm, toast } = useFeedback();
  const [form, setForm] = useState(emptyAccount);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  async function add(e) {
    e.preventDefault();
    setError("");
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) {
      setError("กรุณากรอกชื่อธนาคาร เลขที่บัญชี และชื่อบัญชี");
      document.getElementById(
        !form.bankName.trim() ? `bank-name-${side}` :
          !form.accountNumber.trim() ? `bank-number-${side}` : `bank-account-name-${side}`
      )?.focus();
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "bankAccounts"), {
        side,
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        accountName: form.accountName.trim(),
        note: form.note.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      setForm(emptyAccount);
      setFormOpen(false);
      toast("เพิ่มบัญชีธนาคารแล้ว");
    } catch (addError) {
      console.error(addError);
      setError("เพิ่มบัญชีธนาคารไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function cancelAdd() {
    const dirty = Object.values(form).some((value) => value.trim());
    if (dirty && !await confirm({
      title: "ยกเลิกการเพิ่มบัญชี",
      description: "ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setForm(emptyAccount);
    setError("");
    setFormOpen(false);
  }

  async function remove(id) {
    if (!await confirm({
      title: "ลบบัญชีธนาคาร",
      description: "ลบบัญชีนี้ออกจากรายการโปรด?",
      confirmLabel: "ลบบัญชี",
      danger: true,
    })) return;
    await deleteDoc(doc(db, "bankAccounts", id));
    toast("ลบบัญชีธนาคารแล้ว");
  }

  const list = accounts.filter((a) => a.side === side);

  return (
    <div className="bg-white border border-paperLine rounded-lg p-4 mb-5">
      <h2 className="font-slab text-base mb-1">{title}</h2>
      <p className="text-xs text-inkSoft mb-3">{hint}</p>

      <div className="space-y-2 mb-4">
        {list.length === 0 && <p className="text-sm text-inkSoft">ยังไม่มีบัญชีที่บันทึกไว้</p>}
        {list.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between border border-paperLine rounded px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                <span className="break-words">{a.bankName} · {a.accountNumber}</span>
              </div>
              <div className="text-inkSoft text-xs">
                {a.accountName}
                {a.note ? ` · ${a.note}` : ""}
              </div>
            </div>
            <button onClick={() => remove(a.id)} className="text-xs text-rust">
              ลบ
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setFormOpen((open) => !open)}
        className="mb-3 min-h-11 rounded-lg border border-paperLine px-3 text-sm text-blue-700"
      >
        {formOpen ? "ปิดแบบฟอร์ม" : "+ เพิ่มบัญชี"}
      </button>
      <Sheet
        open={formOpen}
        title={`เพิ่มบัญชี${title}`}
        onClose={cancelAdd}
        header={
          <FormHeader
            title="เพิ่มบัญชีธนาคาร"
            onCancel={cancelAdd}
            formId={`add-account-${side}`}
            saving={busy}
            saveLabel="บันทึก"
          />
        }
      >
      <form id={`add-account-${side}`} onSubmit={add} className="grid gap-2 sm:grid-cols-2">
        <input
          id={`bank-name-${side}`}
          placeholder="ชื่อธนาคาร"
          value={form.bankName}
          onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
          className="border border-paperLine rounded px-3 py-2 text-sm focus:border-teal"
        />
        <input
          id={`bank-number-${side}`}
          placeholder="เลขที่บัญชี"
          value={form.accountNumber}
          onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
          className="border border-paperLine rounded px-3 py-2 text-sm font-nums focus:border-teal"
        />
        <input
          id={`bank-account-name-${side}`}
          placeholder="ชื่อบัญชี"
          value={form.accountName}
          onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
          className="border border-paperLine rounded px-3 py-2 text-sm focus:border-teal"
        />
        <input
          placeholder="หมายเหตุ (ถ้ามี)"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          className="border border-paperLine rounded px-3 py-2 text-sm focus:border-teal"
        />
        {error && <p role="alert" className="col-span-full text-sm text-rust">{error}</p>}
      </form>
      </Sheet>
    </div>
  );
}

function CategoryList({ categories }) {
  const { confirm, toast } = useFeedback();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  async function add(e) {
    e.preventDefault();
    if (!label.trim()) {
      setError("กรุณากรอกชื่อหมวดหมู่");
      document.getElementById("transfer-category-name")?.focus();
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "transferCategories"), {
        label: label.trim(),
        createdAt: serverTimestamp(),
      });
      setLabel("");
      setFormOpen(false);
      toast("เพิ่มหมวดหมู่แล้ว");
    } catch (addError) {
      console.error(addError);
      setError("เพิ่มหมวดหมู่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function cancelAdd() {
    if (label.trim() && !await confirm({
      title: "ยกเลิกการเพิ่มหมวดหมู่",
      description: "ชื่อหมวดหมู่ที่กรอกไว้จะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setLabel("");
    setError("");
    setFormOpen(false);
  }

  async function remove(id) {
    if (!await confirm({
      title: "ลบหมวดหมู่",
      description: "ลบหมวดหมู่นี้?",
      confirmLabel: "ลบหมวดหมู่",
      danger: true,
    })) return;
    await deleteDoc(doc(db, "transferCategories", id));
    toast("ลบหมวดหมู่แล้ว");
  }

  return (
    <div className="bg-white border border-paperLine rounded-lg p-4">
      <h2 className="font-slab text-base mb-1">หมวดหมู่โปรด (สำหรับใบเบิก)</h2>
      <p className="text-xs text-inkSoft mb-3">ใช้เลือกเร็วในตารางเบิกเงิน เช่น ค่าน้ำมัน, เบี้ยเลี้ยง, ค่าสินค้า</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map((c) => (
          <span
            key={c.id}
            className="text-xs bg-paper border border-paperLine rounded-full px-3 py-1 flex items-center gap-2"
          >
            {c.label}
            <button onClick={() => remove(c.id)} className="text-rust">
              ×
            </button>
          </span>
        ))}
        {categories.length === 0 && <p className="text-sm text-inkSoft">ยังไม่มีหมวดหมู่</p>}
      </div>

      <button type="button" onClick={() => setFormOpen(true)} className="min-h-11 rounded-lg border border-paperLine px-3 text-sm text-blue-700">
        + เพิ่มหมวดหมู่
      </button>
      <Sheet
        open={formOpen}
        title="เพิ่มหมวดหมู่"
        onClose={cancelAdd}
        header={<FormHeader title="เพิ่มหมวดหมู่" onCancel={cancelAdd} formId="add-transfer-category" saving={busy} />}
      >
        <form id="add-transfer-category" onSubmit={add} className="space-y-3">
          <input
            id="transfer-category-name"
            autoFocus
            placeholder="ชื่อหมวดหมู่ใหม่"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setError("");
            }}
            className="w-full border border-paperLine rounded px-3 py-2 text-sm focus:border-teal"
          />
          {error && <p role="alert" className="text-sm text-rust">{error}</p>}
        </form>
      </Sheet>
    </div>
  );
}

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [section, setSection] = useState("source");

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "bankAccounts"), (snap) =>
      setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub2 = onSnapshot(collection(db, "transferCategories"), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  return (
    <Layout>
      <h1 className="font-slab text-lg mb-4">บัญชีธนาคาร & หมวดหมู่โปรด</h1>
      <div role="tablist" aria-label="บัญชีธนาคารและหมวดหมู่" className="mb-4 flex gap-2 overflow-x-auto">
        {[
          ["source", "บัญชีต้นทาง"],
          ["payee", "บัญชีผู้รับ"],
          ["categories", "หมวดหมู่"],
        ].map(([value, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={section === value}
            key={value}
            onClick={() => setSection(value)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${
              section === value ? "border-blue-600 bg-blue-600 text-white" : "border-paperLine bg-white text-inkSoft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {section === "source" && <AccountList
        title="บัญชีของเรา (A — บัญชีต้นทาง/รับเงินเบิกเข้า)"
        hint="บัญชีที่ใช้รับเงินตอนเบิก และเป็นบัญชีต้นทางตอนโอนจ่ายออก"
        side="source"
        accounts={accounts}
      />}
      {section === "payee" && <AccountList
        title="บัญชีผู้รับโอน (B — ปลายทาง)"
        hint="บัญชีของผู้รับเงินปลายทาง เช่น ซัพพลายเออร์ พนักงาน"
        side="payee"
        accounts={accounts}
      />}
      {section === "categories" && <CategoryList categories={categories} />}
    </Layout>
  );
}
