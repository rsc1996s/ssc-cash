import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useFeedback } from "./ui/FeedbackProvider";
import { normalizeSearchText } from "./ui/searchText";

const CATEGORY_TYPES = [
  { collectionName: "cashCategories", label: "เงินสด", hint: "ใช้เลือกเร็วตอนบันทึกรายรับ-รายจ่ายเงินสด" },
  { collectionName: "transferCategories", label: "ใบเบิกโอน", hint: "ใช้เลือกเร็วในรายการใบเบิกเงินโอน" },
];

function normalizeLabel(label) {
  return normalizeSearchText(label).replace(/\s+/g, "");
}

export default function CategoryManager() {
  const { confirm, toast } = useFeedback();
  const [typeIndex, setTypeIndex] = useState(0);
  const [categories, setCategories] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeType = CATEGORY_TYPES[typeIndex];

  useEffect(() => {
    setCategories([]);
    const unsubscribe = onSnapshot(
      collection(db, activeType.collectionName),
      (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (loadError) => {
        console.error("โหลดหมวดหมู่ไม่สำเร็จ:", loadError);
        setError("โหลดหมวดหมู่ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
      }
    );
    return () => unsubscribe();
  }, [activeType.collectionName]);

  useEffect(() => {
    if (activeType.collectionName !== "transferCategories") return undefined;
    const unsubscribe = onSnapshot(
      collection(db, "withdrawalRequests"),
      (snapshot) => setWithdrawals(snapshot.docs.map((item) => item.data())),
      (loadError) => {
        console.error("โหลดหมวดหมู่จากใบเบิกไม่สำเร็จ:", loadError);
        setError("โหลดหมวดหมู่จากใบเบิกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
      }
    );
    return () => unsubscribe();
  }, [activeType.collectionName]);

  const uncataloguedCategories = useMemo(() => {
    const known = new Set(categories.map((category) => normalizeLabel(category.label || "")));
    const counts = new Map();
    withdrawals.forEach((withdrawal) => {
      (withdrawal.lines || []).forEach((line) => {
        const label = typeof line.categoryLabel === "string" ? line.categoryLabel.trim() : "";
        const normalized = normalizeLabel(label);
        if (!normalized || known.has(normalized)) return;
        const entry = counts.get(normalized) || { label, count: 0 };
        entry.count += 1;
        counts.set(normalized, entry);
      });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));
  }, [categories, withdrawals]);

  async function addCategory(event, suppliedLabel) {
    event?.preventDefault();
    const trimmedLabel = (suppliedLabel ?? label).trim();
    if (!trimmedLabel) {
      setError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }
    if (categories.some((category) =>
      typeof category.label === "string" && normalizeLabel(category.label) === normalizeLabel(trimmedLabel)
    )) {
      setError("มีชื่อหมวดหมู่นี้อยู่แล้ว");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await addDoc(collection(db, activeType.collectionName), {
        label: trimmedLabel,
        createdAt: serverTimestamp(),
      });
      setLabel("");
      toast("เพิ่มหมวดหมู่แล้ว");
    } catch (addError) {
      console.error("เพิ่มหมวดหมู่ไม่สำเร็จ:", addError);
      setError("เพิ่มหมวดหมู่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category) {
    if (!await confirm({
      title: "ลบหมวดหมู่",
      description: `ต้องการลบหมวดหมู่ “${category.label}” หรือไม่?`,
      confirmLabel: "ลบหมวดหมู่",
      danger: true,
    })) return;

    try {
      await deleteDoc(doc(db, activeType.collectionName, category.id));
      toast("ลบหมวดหมู่แล้ว");
    } catch (deleteError) {
      console.error("ลบหมวดหมู่ไม่สำเร็จ:", deleteError);
      setError("ลบหมวดหมู่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <section className="rounded-xl border border-paperLine bg-white p-4 sm:p-5">
      <div role="tablist" aria-label="ประเภทหมวดหมู่" className="mb-4 grid grid-cols-2 gap-2">
        {CATEGORY_TYPES.map((type, index) => (
          <button
            key={type.collectionName}
            type="button"
            role="tab"
            aria-selected={typeIndex === index}
            onClick={() => {
              setTypeIndex(index);
              setError("");
            }}
            className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${
              typeIndex === index ? "border-blue-600 bg-blue-600 text-white" : "border-paperLine bg-white text-inkSoft"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm text-inkSoft">{activeType.hint}</p>
      <form onSubmit={addCategory} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            setError("");
          }}
          placeholder="ชื่อหมวดหมู่ใหม่"
          aria-label="ชื่อหมวดหมู่ใหม่"
          className="min-w-0 flex-1 border border-paperLine px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "กำลังเพิ่ม..." : "เพิ่มหมวดหมู่"}
        </button>
      </form>

      {error && <p role="alert" className="mb-3 text-sm text-rust">{error}</p>}
      {activeType.collectionName === "transferCategories" && uncataloguedCategories.length > 0 && (
        <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
          <h3 className="mb-2 text-sm font-semibold">หมวดที่ยังไม่อยู่ในคลัง</h3>
          <ul className="divide-y divide-blue-100">
            {uncataloguedCategories.map((item) => (
              <li key={normalizeLabel(item.label)} className="flex min-h-14 items-center gap-3 py-2">
                <span className="min-w-0 flex-1 break-words text-sm">
                  {item.label} <span className="text-xs text-inkSoft">พบ {item.count} ครั้ง</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addCategory(undefined, item.label)}
                  aria-label={`เพิ่มหมวดหมู่ ${item.label} เข้าคลัง`}
                  className="min-h-11 min-w-11 shrink-0 rounded-lg border border-blue-300 bg-white px-3 text-lg font-semibold text-blue-700"
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {categories.length === 0 ? (
        <p className="text-sm text-inkSoft">ยังไม่มีหมวดหมู่</p>
      ) : (
        <ul className="divide-y divide-paperLine">
          {categories.map((category) => (
            <li key={category.id} className="flex min-h-14 items-center gap-3 py-2">
              <span className="min-w-0 flex-1 break-words text-sm">{category.label}</span>
              <button
                type="button"
                onClick={() => removeCategory(category)}
                aria-label={`ลบหมวดหมู่ ${category.label}`}
                className="min-h-11 min-w-11 shrink-0 rounded-lg border border-red-200 px-3 text-sm font-medium text-rust hover:bg-red-50"
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
