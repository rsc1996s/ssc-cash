import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeSearchText } from "../components/ui/searchText";

export function categoryKey(label) {
  return normalizeSearchText(label || "").replace(/\s+/g, "");
}

export default function useCategories() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const groups = { cashCategories: [], transferCategories: [] };
    const loaded = new Set();
    const update = () => {
      const merged = new Map();
      Object.entries(groups).forEach(([collectionName, entries]) => entries.forEach((entry) => {
        const key = categoryKey(entry.label);
        if (!key) return;
        const existing = merged.get(key) || { label: entry.label, refs: [] };
        existing.refs.push({ collectionName, id: entry.id });
        merged.set(key, existing);
      }));
      setCategories([...merged.values()].sort((a, b) => a.label.localeCompare(b.label, "th")));
    };
    const unsubscribers = Object.keys(groups).map((collectionName) => onSnapshot(
      collection(db, collectionName),
      (snapshot) => {
        groups[collectionName] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        loaded.add(collectionName);
        setLoading(loaded.size !== Object.keys(groups).length);
        update();
      },
      (loadError) => {
        console.error("โหลดหมวดหมู่ไม่สำเร็จ:", loadError);
        setError("โหลดหมวดหมู่ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
      }
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  return { categories, error, loading };
}
