import { collection, doc, getDocsFromServer, query, runTransaction, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { newAuditEvent, queueAuditEvent } from "./audit";

export function newFundTopupRef() {
  return doc(collection(db, "fundTopups"));
}

export async function createFundTopup({ ref, fundId, amount, date, note, user, profile, retry }) {
  if (!user || profile?.role !== "owner" || profile.disabled === true) {
    throw new Error("เฉพาะเจ้าของร้านที่ใช้งานได้เท่านั้นที่เติมเงินได้");
  }
  if (retry) {
    const existing = await getDocsFromServer(query(collection(db, "fundTopups"), where("fundId", "==", fundId)));
    if (existing.docs.some((entry) => entry.id === ref.id)) return { alreadyRecorded: true };
  }
  const after = { fundId, amount, topupDate: Timestamp.fromDate(date) };
  const audit = newAuditEvent({
    actorUid: user.uid,
    actorName: profile?.name || user.email,
    action: "fund-topup-created",
    targetCollection: "fundTopups",
    targetId: ref.id,
    before: null,
    after,
  });
  const fundRef = doc(db, "funds", fundId);
  await runTransaction(db, async (batch) => {
    const fundSnapshot = await batch.get(fundRef);
    if (!fundSnapshot.exists() || fundSnapshot.data().archived === true) {
      throw new Error("งบนี้ถูกปิดใช้งานแล้ว ไม่สามารถเติมเงิน");
    }
    batch.set(ref, {
      ...after,
      note,
      createdBy: user.uid,
      createdByName: profile?.name || user.email,
      createdAt: serverTimestamp(),
      auditLogId: audit.ref.id,
    });
    batch.update(fundRef, {
      lastCreatedTopupId: ref.id,
      topupCreatedAt: serverTimestamp(),
    });
    queueAuditEvent(batch, audit);
  });
  return { alreadyRecorded: false };
}
