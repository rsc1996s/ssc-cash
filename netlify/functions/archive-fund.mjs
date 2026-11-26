import { FieldValue } from "firebase-admin/firestore";
import { adminServices, HttpError, jsonResponse } from "./close-daily-fund.mjs";

async function archiveFund(db, uid, input) {
  if (!input || typeof input.fundId !== "string" || !input.fundId || input.fundId.includes("/")) {
    throw new HttpError(400, "invalid-argument", "กรุณาเลือกงบค่าใช้จ่าย");
  }
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 1000) {
    throw new HttpError(400, "invalid-argument", "กรุณาระบุเหตุผลไม่เกิน 1,000 ตัวอักษร");
  }
  const reason = input.reason.trim();
  const fundRef = db.doc(`funds/${input.fundId}`);
  const userRef = db.doc(`users/${uid}`);
  const pending = db.collection("transactions").where("fundId", "==", input.fundId)
    .where("status", "in", ["pending", "needs_evidence"]).limit(1);
  const auditRef = db.collection("auditLogs").doc();
  const activityRef = db.doc(`activityLogs/${auditRef.id}`);

  return db.runTransaction(async (transaction) => {
    const [userSnapshot, fundSnapshot, pendingSnapshot] = await Promise.all([
      transaction.get(userRef), transaction.get(fundRef), transaction.get(pending),
    ]);
    const user = userSnapshot.exists ? userSnapshot.data() : null;
    if (!user || user.role !== "owner" || user.disabled === true) {
      throw new HttpError(403, "permission-denied", "เฉพาะเจ้าของที่ใช้งานได้เท่านั้นที่ปิดงบได้");
    }
    if (!fundSnapshot.exists) throw new HttpError(404, "not-found", "ไม่พบงบค่าใช้จ่าย");
    const fund = fundSnapshot.data();
    if (fund.archived === true) throw new HttpError(409, "already-exists", "งบนี้ปิดใช้งานแล้ว");
    if (!pendingSnapshot.empty) {
      throw new HttpError(409, "failed-precondition", "ยังมีรายการรอตรวจหรือรอหลักฐาน กรุณาจัดการให้เสร็จก่อนปิดงบ");
    }
    const createdAt = FieldValue.serverTimestamp();
    const actorName = typeof user.name === "string" ? user.name : "";
    const audit = {
      actorUid: uid, actorName, action: "fund-archived",
      targetCollection: "funds", targetId: input.fundId,
      before: { archived: false, label: fund.label },
      after: { archived: true, label: fund.label, reason },
      createdAt,
    };
    transaction.update(fundRef, {
      archived: true, archivedBy: uid, archivedByName: actorName,
      archivedAt: createdAt, archiveReason: reason, auditLogId: auditRef.id,
    });
    transaction.create(auditRef, audit);
    transaction.create(activityRef, audit);
    return { fundId: input.fundId };
  });
}

export default async (request) => {
  if (request.method !== "POST") return jsonResponse(405, { code: "method-not-allowed", message: "รองรับเฉพาะ POST" });
  const tokenMatch = (request.headers.get("authorization") || "").match(/^Bearer (.+)$/);
  if (!tokenMatch) return jsonResponse(401, { code: "unauthenticated", message: "กรุณาเข้าสู่ระบบ" });
  try {
    const { auth, db } = adminServices();
    const decoded = await auth.verifyIdToken(tokenMatch[1], true);
    const result = await archiveFund(db, decoded.uid, await request.json());
    return jsonResponse(200, result);
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse(error.status, { code: error.code, message: error.message });
    if (error instanceof SyntaxError) return jsonResponse(400, { code: "invalid-argument", message: "ข้อมูลคำขอไม่ถูกต้อง" });
    if (["auth/id-token-expired", "auth/id-token-revoked", "auth/argument-error", "auth/invalid-id-token"].includes(error.code)) {
      return jsonResponse(401, { code: "unauthenticated", message: "กรุณาเข้าสู่ระบบใหม่" });
    }
    if (error.code === "auth/user-disabled") return jsonResponse(403, { code: "permission-denied", message: "บัญชีนี้ถูกปิดใช้งาน" });
    console.error("Netlify fund archive failed:", error);
    return jsonResponse(500, { code: "internal", message: "ปิดงบไม่สำเร็จ กรุณาลองใหม่" });
  }
};

export { archiveFund };
