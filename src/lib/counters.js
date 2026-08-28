import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * สร้างเลขที่เอกสารรันอัตโนมัติแบบต่อเนื่อง ไม่ซ้ำ ปลอดภัยแม้มีการบันทึกพร้อมกัน
 * เช่น nextDocNumber('withdrawalRequests', 'WR') -> "WR-0001", "WR-0002", ...
 */
export async function nextDocNumber(counterId, prefix) {
  const ref = doc(db, "counters", counterId);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? snap.data().seq || 0 : 0;
    const next = current + 1;
    tx.set(ref, { seq: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}
