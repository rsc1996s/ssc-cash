import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { parseSatang } from "./money.js";
import { parseBangkokDate } from "./businessDate.js";
import { receiptDescription } from "./receiptData.js";

export function newTransactionRef() {
  return doc(collection(db, "transactions"));
}

export async function commitTransaction(transactionRef, fundId, transactionData) {
  const fundRef = doc(db, "funds", fundId);
  await runTransaction(db, async (batch) => {
    const fundSnapshot = await batch.get(fundRef);
    if (!fundSnapshot.exists() || fundSnapshot.data().archived === true) {
      throw new Error("งบนี้ถูกปิดใช้งานแล้ว กรุณาเลือกงบอื่น");
    }
    batch.set(transactionRef, transactionData);
    batch.update(fundRef, {
      lastCreatedTransactionId: transactionRef.id,
      transactionCreatedAt: serverTimestamp(),
    });
  });
}

export async function createIncomeTransfer({ user, profile, fund, amount, customer, reference, transactionDate, transactionRef }) {
  const satang = parseSatang(amount);
  if (!parseBangkokDate(transactionDate)) throw new Error("กรุณาเลือกวันที่ทำรายการที่ถูกต้อง");
  const note = reference.trim();
  if (note.length > 2000) throw new Error("หมายเหตุยาวเกิน 2,000 ตัวอักษร");
  const data = {
    fundId: fund.id, fundLabel: fund.label, transactionDate, type: "income",
    amount: satang / 100, withdrawnAmount: null, itemDescription: receiptDescription(customer),
    changeAmount: 0, paymentMethod: "transfer", category: "ขายหน้าร้าน", note,
    receiptPhotoURL: null, receiptPhotoURLs: [], changePhotoURL: null, status: "pending",
    createdBy: user.uid, createdByName: profile?.name || user.email,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    reviewedBy: null, reviewedByName: null, reviewedAt: null, reviewNote: null, editHistory: [],
  };
  await commitTransaction(transactionRef, fund.id, data);
}
