import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";

const ROLE_LABEL = {
  pending: "รออนุมัติ",
  staff: "พนักงาน",
  owner: "เจ้าของ/ผู้จัดการ",
  guest: "ผู้อ่าน (Guest)",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);

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
      <h1 className="font-slab text-lg mb-4">จัดการผู้ใช้งาน</h1>

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
                  <div className="text-xs text-inkSoft font-nums">@{u.username || "-"}</div>
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
              <div className="text-xs text-inkSoft font-nums">@{u.username || "-"}</div>
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
