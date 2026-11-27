import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { collection, getDocsFromServer, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { createIncomeTransfer, newTransactionRef } from "../lib/createIncomeTransfer";
import { drainReceiptQueue } from "../lib/receiptQueue";

const ReceiptQueueContext = createContext(null);

export function useReceiptQueue() {
  const context = useContext(ReceiptQueueContext);
  if (!context) throw new Error("ReceiptQueueProvider is required");
  return context;
}

export default function ReceiptQueueProvider({ children }) {
  const { user, profile } = useAuth();
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const active = useRef(false);
  const userRef = useRef(user);
  const profileRef = useRef(profile);
  userRef.current = user;
  profileRef.current = profile;

  const update = useCallback((fn) => {
    itemsRef.current = fn(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const run = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    try {
      await drainReceiptQueue({
        getItems: () => itemsRef.current,
        update,
        save: async (item) => {
          if (!userRef.current || userRef.current.uid !== item.uid) {
            throw new Error("บัญชีผู้ใช้เปลี่ยน ต้องเข้าสู่ระบบด้วยบัญชีเดิม");
          }
          if (item.attempted) {
            const snapshot = await getDocsFromServer(query(collection(db, "transactions"),
              where("fundId", "==", item.fund.id), where("createdBy", "==", item.uid)));
            if (snapshot.docs.some((entry) => entry.id === item.id)) {
              return;
            }
          }
          await createIncomeTransfer({ ...item, user: userRef.current, profile: profileRef.current, transactionRef: item.ref });
        },
      });
    } finally {
      active.current = false;
    }
  }, [update]);

  const enqueue = useCallback((draft) => {
    const ref = newTransactionRef();
    update((current) => [...current, { ...draft, id: ref.id, ref, uid: userRef.current.uid, state: "queued", attempted: false }]);
    void run();
  }, [run, update]);

  const retry = useCallback((id) => {
    update((current) => current.map((entry) => entry.id === id && entry.state === "failed" ? { ...entry, state: "queued" } : entry));
    void run();
  }, [run, update]);

  const remove = useCallback((id) => {
    update((current) => current.filter((entry) => entry.id !== id || entry.state !== "failed"));
  }, [update]);

  useEffect(() => {
    if (!items.length) return undefined;
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [items.length]);

  return <ReceiptQueueContext.Provider value={{ items, enqueue, retry, remove }}>{children}</ReceiptQueueContext.Provider>;
}
