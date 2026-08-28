import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";

const emptyAccount = { bankName: "", accountNumber: "", accountName: "", note: "" };

function AccountList({ title, hint, side, accounts }) {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyAccount);
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) return;
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
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm("ลบบัญชีนี้ออกจากรายการโปรด?")) return;
    await deleteDoc(doc(db, "bankAccounts", id));
  }

  const list = accounts.filter((a) => a.side === side);

  return (
    <div className="bg-white border border-paperLine rounded-lg p-4 receipt-edge mb-5">
      <h2 className="font-slab text-base mb-1">{title}</h2>
      <p className="text-xs text-inkSoft mb-3">{hint}</p>

      <div className="space-y-2 mb-4">
        {list.length === 0 && <p className="text-sm text-inkSoft">ยังไม่มีบัญชีที่บันทึกไว้</p>}
        {list.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between border border-paperLine rounded px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">
                {a.bankName} · {a.accountNumber}
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

      <form onSubmit={add} className="grid grid-cols-2 gap-2">
        <input
          placeholder="ชื่อธนาคาร"
          value={form.bankName}
          onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
          className="border border-paperLine rounded px-3 py-2 text-sm focus:border-teal"
        />
        <input
          placeholder="เลขที่บัญชี"
          value={form.accountNumber}
          onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
          className="border border-paperLine rounded px-3 py-2 text-sm font-nums focus:border-teal"
        />
        <input
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
        <button
          type="submit"
          disabled={busy}
          className="col-span-2 bg-teal text-white rounded py-2 text-sm font-medium disabled:opacity-60"
        >
          + บันทึกเป็นรายการโปรด
        </button>
      </form>
    </div>
  );
}

function CategoryList({ categories }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "transferCategories"), {
        label: label.trim(),
        createdAt: serverTimestamp(),
      });
      setLabel("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm("ลบหมวดหมู่นี้?")) return;
    await deleteDoc(doc(db, "transferCategories", id));
  }

  return (
    <div className="bg-white border border-paperLine rounded-lg p-4 receipt-edge">
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

      <form onSubmit={add} className="flex gap-2">
        <input
          placeholder="ชื่อหมวดหมู่ใหม่"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 border border-paperLine rounded px-3 py-2 text-sm focus:border-teal"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-teal text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          เพิ่ม
        </button>
      </form>
    </div>
  );
}

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);

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
      <AccountList
        title="บัญชีของเรา (A — บัญชีต้นทาง/รับเงินเบิกเข้า)"
        hint="บัญชีที่ใช้รับเงินตอนเบิก และเป็นบัญชีต้นทางตอนโอนจ่ายออก"
        side="source"
        accounts={accounts}
      />
      <AccountList
        title="บัญชีผู้รับโอน (B — ปลายทาง)"
        hint="บัญชีของผู้รับเงินปลายทาง เช่น ซัพพลายเออร์ พนักงาน"
        side="payee"
        accounts={accounts}
      />
      <CategoryList categories={categories} />
    </Layout>
  );
}
