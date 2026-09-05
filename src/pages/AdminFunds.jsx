import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { formatBaht, formatDateTime } from "../lib/format";
import { currentFundBalance } from "../lib/ledger";

function CashCategoryManager() {
  const [categories, setCategories] = useState([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cashCategories"), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "cashCategories"), {
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
    await deleteDoc(doc(db, "cashCategories", id));
  }

  return (
    <div className="bg-white border border-paperLine rounded-lg p-5 receipt-edge max-w-md mt-6">
      <h2 className="font-slab text-base mb-1">หมวดหมู่รายการเงินสด</h2>
      <p className="text-xs text-inkSoft mb-3">
        ใช้เลือกเร็วตอนบันทึกรายรับ-รายจ่ายเงินสด เช่น ค่าวัตถุดิบ, ค่าน้ำมัน, ค่าขนส่ง
      </p>
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

export default function AdminFunds() {
  const { user, profile } = useAuth();
  const [funds, setFunds] = useState([]);
  const [topups, setTopups] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [newFund, setNewFund] = useState({ label: "", openingBalance: "" });
  const [topupDraft, setTopupDraft] = useState({}); // { [fundId]: {amount, note} }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "funds"), orderBy("createdAt", "asc")), (s) =>
      setFunds(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub2 = onSnapshot(collection(db, "fundTopups"), (s) =>
      setTopups(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub3 = onSnapshot(collection(db, "transactions"), (s) =>
      setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  async function createFund(e) {
    e.preventDefault();
    setError("");
    if (!newFund.label.trim() || !newFund.openingBalance) {
      setError("กรุณากรอกชื่อฝั่งและยอดเงินตั้งต้น");
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "funds"), {
        label: newFund.label.trim(),
        openingBalance: Number(newFund.openingBalance),
        createdAt: serverTimestamp(),
      });
      setNewFund({ label: "", openingBalance: "" });
    } finally {
      setBusy(false);
    }
  }

  async function submitTopup(fundId) {
    const draft = topupDraft[fundId] || {};
    if (!draft.amount || Number(draft.amount) <= 0) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "fundTopups"), {
        fundId,
        amount: Number(draft.amount),
        note: (draft.note || "").trim(),
        createdBy: user.uid,
        createdByName: profile?.name || user.email,
        createdAt: serverTimestamp(),
      });
      setTopupDraft((d) => ({ ...d, [fundId]: { amount: "", note: "" } }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <h1 className="font-slab text-lg mb-4">กองทุนหมุนเวียน</h1>

      <div className="space-y-4 mb-8">
        {funds.map((f) => {
          const balance = currentFundBalance(f, topups, transactions);
          const draft = topupDraft[f.id] || { amount: "", note: "" };
          return (
            <div key={f.id} className="bg-white border border-paperLine rounded-lg p-5 receipt-edge">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-slab text-lg">{f.label}</div>
                  <div className="text-xs text-inkSoft">
                    ยอดตั้งต้น {formatBaht(f.openingBalance)} บาท
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-inkSoft">ยอดคงเหลือปัจจุบัน</div>
                  <div className="font-nums text-2xl text-teal">{formatBaht(balance)}</div>
                </div>
              </div>

              <div className="flex gap-2 items-end border-t border-paperLine pt-3">
                <div className="flex-1">
                  <label className="text-xs text-inkSoft block mb-1">เติมเงินเข้ากองทุน (บาท)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.amount}
                    onChange={(e) =>
                      setTopupDraft((d) => ({ ...d, [f.id]: { ...draft, amount: e.target.value } }))
                    }
                    className="w-full border border-paperLine rounded px-3 py-1.5 font-nums text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-inkSoft block mb-1">หมายเหตุ</label>
                  <input
                    value={draft.note}
                    onChange={(e) =>
                      setTopupDraft((d) => ({ ...d, [f.id]: { ...draft, note: e.target.value } }))
                    }
                    className="w-full border border-paperLine rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <button
                  disabled={busy}
                  onClick={() => submitTopup(f.id)}
                  className="bg-teal text-white rounded px-4 py-1.5 text-sm font-medium"
                >
                  เติมเงิน
                </button>
              </div>

              <details className="mt-3">
                <summary className="text-xs text-inkSoft cursor-pointer">ประวัติการเติมเงิน</summary>
                <ul className="text-xs text-inkSoft mt-2 space-y-1">
                  {topups
                    .filter((t) => t.fundId === f.id)
                    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                    .map((t) => (
                      <li key={t.id}>
                        +{formatBaht(t.amount)} บาท โดย {t.createdByName} ·{" "}
                        {formatDateTime(t.createdAt)} {t.note && `(${t.note})`}
                      </li>
                    ))}
                </ul>
              </details>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-paperLine rounded-lg p-5 receipt-edge max-w-md">
        <h2 className="font-slab text-base mb-3">เพิ่มฝั่งเงินหมุนเวียนใหม่</h2>
        <form onSubmit={createFund} className="space-y-3">
          <div>
            <label className="text-sm text-inkSoft block mb-1">ชื่อฝั่ง</label>
            <input
              value={newFund.label}
              onChange={(e) => setNewFund((f) => ({ ...f, label: e.target.value }))}
              placeholder="เช่น หน้าร้าน"
              className="w-full border border-paperLine rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">ยอดเงินตั้งต้น (บาท)</label>
            <input
              type="number"
              step="0.01"
              value={newFund.openingBalance}
              onChange={(e) => setNewFund((f) => ({ ...f, openingBalance: e.target.value }))}
              placeholder="เช่น 30000"
              className="w-full border border-paperLine rounded px-3 py-2 font-nums"
            />
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="bg-ink text-white rounded px-4 py-2 text-sm font-medium"
          >
            สร้างฝั่งใหม่
          </button>
        </form>
      </div>

      <CashCategoryManager />
    </Layout>
  );
}
