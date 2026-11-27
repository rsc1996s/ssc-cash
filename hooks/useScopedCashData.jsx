import { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const empty = { funds: [], topups: [], transactions: [] };
const ScopedCashContext = createContext(null);

export function ScopedCashDataProvider({ children }) {
  const { user, profile, loading: authLoading } = useAuth();
  const assigned = profile && Object.hasOwn(profile, "fundIds") ? profile.fundIds : null;
  const key = JSON.stringify([user?.uid, profile?.role, profile?.disabled, profile && Object.hasOwn(profile, "fundIds"), assigned]);
  const [state, setState] = useState({ key: "", ...empty, loading: true, error: null });

  useEffect(() => {
    let active = true;
    let failed = false;
    const subscriptions = [];
    const snapshots = new Map();
    const pending = new Set();
    const uid = user?.uid;
    const role = profile?.role;
    const hasAssignment = profile && Object.hasOwn(profile, "fundIds");
    const ids = hasAssignment ? profile.fundIds : null;

    if (authLoading) return undefined;
    if (!uid || profile?.disabled || !["owner", "staff", "guest"].includes(role)) {
      setState({ key, ...empty, loading: false, error: null });
      return undefined;
    }
    if (role !== "owner" && hasAssignment && (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id || id.includes("/")))) {
      setState({ key, ...empty, loading: false, error: new Error("ข้อมูลงบที่ได้รับมอบหมายไม่ถูกต้อง กรุณาติดต่อแอดมิน") });
      return undefined;
    }

    const requests = [];
    const add = (kind, name, reference) => requests.push({ kind, name, reference });
    const allFunds = role === "owner" || !hasAssignment;
    if (allFunds) {
      add("funds", "funds", collection(db, "funds"));
      add("topups", "topups", collection(db, "fundTopups"));
      if (role === "owner") {
        add("transactions", "transactions", collection(db, "transactions"));
      } else {
        add("transactions", "approved", query(collection(db, "transactions"), where("status", "==", "approved")));
        add("transactions", "own", query(collection(db, "transactions"), where("createdBy", "==", uid)));
      }
    } else {
      // Emulator verified fundId == id queries; an in query also passed only for authorized IDs.
      [...new Set(ids)].forEach((id) => {
        add("funds", `fund:${id}`, doc(db, "funds", id));
        add("topups", `topups:${id}`, query(collection(db, "fundTopups"), where("fundId", "==", id)));
        add("transactions", `approved:${id}`, query(collection(db, "transactions"), where("fundId", "==", id), where("status", "==", "approved")));
        add("transactions", `own:${id}`, query(collection(db, "transactions"), where("fundId", "==", id), where("createdBy", "==", uid)));
      });
    }

    requests.forEach(({ name }) => pending.add(name));
    const publish = () => {
      if (!active || failed) return;
      const merged = { funds: new Map(), topups: new Map(), transactions: new Map() };
      snapshots.forEach(({ kind, items }) => items.forEach((item) => merged[kind].set(item.id, item)));
      setState({
        key,
        funds: [...merged.funds.values()],
        topups: [...merged.topups.values()],
        transactions: [...merged.transactions.values()],
        loading: pending.size > 0,
        error: null,
      });
    };
    setState({ key, ...empty, loading: requests.length > 0, error: null });
    requests.forEach(({ kind, name, reference }) => {
      subscriptions.push(onSnapshot(reference, (snapshot) => {
        const docs = "docs" in snapshot ? snapshot.docs : snapshot.exists() ? [snapshot] : [];
        snapshots.set(name, { kind, items: docs.map((item) => ({ id: item.id, ...item.data() })) });
        pending.delete(name);
        publish();
      }, (error) => {
        console.error("โหลดข้อมูลงบที่ดูแลไม่สำเร็จ:", error);
        failed = true;
        if (active) setState({ key, ...empty, loading: false, error });
      }));
    });
    return () => {
      active = false;
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [key, authLoading]);

  const current = state.key === key ? state : { ...empty, loading: true, error: null };
  return (
    <ScopedCashContext.Provider value={{ ...current, empty: !current.loading && !current.error && current.funds.length === 0 }}>
      {children}
    </ScopedCashContext.Provider>
  );
}

export default function useScopedCashData() {
  const value = useContext(ScopedCashContext);
  if (!value) throw new Error("useScopedCashData requires ScopedCashDataProvider");
  return value;
}
