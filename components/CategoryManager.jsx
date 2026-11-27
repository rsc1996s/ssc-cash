import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import useCategories, { categoryKey } from "../hooks/useCategories";
import { useFeedback } from "./ui/FeedbackProvider";
import Input from "./ui/Input";
import Sheet from "./ui/Sheet";

export default function CategoryManager() {
  const { confirm, toast } = useFeedback();
  const { categories, loading, error: loadError } = useCategories();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [withdrawals, setWithdrawals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(collection(db, "withdrawalRequests"),
    (snapshot) => setWithdrawals(snapshot.docs.map((item) => item.data())),
    (err) => {
      console.error("โหลดหมวดหมู่จากใบเบิกไม่สำเร็จ:", err);
      setError("โหลดหมวดหมู่จากใบเบิกไม่สำเร็จ");
    }), []);

  const uncatalogued = useMemo(() => {
    const known = new Set(categories.map((category) => categoryKey(category.label)));
    const found = new Map();
    withdrawals.forEach((withdrawal) => (withdrawal.lines || []).forEach((line) => {
      const label = typeof line.categoryLabel === "string" ? line.categoryLabel.trim() : "";
      const key = categoryKey(label);
      if (key && !known.has(key)) found.set(key, label);
    }));
    return [...found.values()];
  }, [categories, withdrawals]);

  const query = categoryKey(search);
  const matching = categories.filter((category) => categoryKey(category.label).includes(query));
  const suggestions = uncatalogued.filter((label) => categoryKey(label).includes(query));

  async function addCategory(label) {
    const value = label.trim();
    if (!value || loading || loadError) return;
    if (categories.some((category) => categoryKey(category.label) === categoryKey(value))) {
      setError("มีหมวดหมู่นี้อยู่แล้ว");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addDoc(collection(db, "cashCategories"), { label: value, createdAt: serverTimestamp() });
      toast("เพิ่มหมวดหมู่แล้ว");
      setSearch("");
    } catch (err) {
      console.error("เพิ่มหมวดหมู่ไม่สำเร็จ:", err);
      setError("เพิ่มหมวดหมู่ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category) {
    if (!await confirm({
      title: "ลบหมวดหมู่",
      description: `ลบ “${category.label}” ออกจากคลังหมวดหมู่ทั้งหมดหรือไม่? รายการเก่าจะยังคงชื่อเดิม`,
      confirmLabel: "ลบหมวดหมู่",
      danger: true,
    })) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      category.refs.forEach((ref) => batch.delete(doc(db, ref.collectionName, ref.id)));
      await batch.commit();
      toast("ลบหมวดหมู่แล้ว");
    } catch (err) {
      console.error("ลบหมวดหมู่ไม่สำเร็จ:", err);
      setError("ลบหมวดหมู่ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 w-full items-center justify-between rounded-lg border border-paperLine bg-white px-4 text-left">
        <span>หมวดหมู่ทั้งหมด</span><span className="text-sm text-inkSoft">{categories.length} หมวด ›</span>
      </button>
      <Sheet open={open} title="หมวดหมู่ทั้งหมด" onClose={() => setOpen(false)}>
        <Input value={search} onChange={(event) => { setSearch(event.target.value); setError(""); }}
          placeholder="ค้นหาหมวดหมู่" aria-label="ค้นหาหมวดหมู่" className="mb-4 w-full" />
        {(error || loadError) && <p role="alert" className="mb-3 text-sm text-danger">{error || loadError}</p>}
        {loading && <p role="status" className="text-sm text-inkSoft">กำลังโหลดหมวดหมู่...</p>}
        {!loading && matching.length === 0 && <p className="mb-3 text-sm text-inkSoft">ไม่พบหมวดหมู่</p>}
        {search.trim() && !categories.some((category) => categoryKey(category.label) === query) && (
          <button type="button" disabled={busy || loading || Boolean(loadError)} onClick={() => addCategory(search)}
            className="mb-3 min-h-11 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 text-left text-sm text-blue-800">
            + เพิ่มหมวดหมู่ใหม่ “{search.trim()}”
          </button>
        )}
        <ul className="divide-y divide-paperLine">
          {matching.map((category) => (
            <li key={categoryKey(category.label)} className="flex min-h-14 items-center gap-3 py-2">
              <span className="min-w-0 flex-1 break-words text-sm">{category.label}</span>
              <button type="button" disabled={busy} onClick={() => removeCategory(category)}
                className="min-h-11 rounded-lg border border-red-200 px-3 text-sm text-danger">ลบ</button>
            </li>
          ))}
        </ul>
        {suggestions.length > 0 && (
          <section className="mt-4 rounded-lg bg-blue-50 p-3">
            <h3 className="mb-2 text-sm font-semibold">หมวดจากใบเบิกที่ยังไม่อยู่ในคลัง</h3>
            {suggestions.map((label) => (
              <button key={categoryKey(label)} type="button" disabled={busy || loading || Boolean(loadError)}
                onClick={() => addCategory(label)} className="block min-h-11 w-full text-left text-sm text-blue-800">+ {label}</button>
            ))}
          </section>
        )}
      </Sheet>
    </>
  );
}
