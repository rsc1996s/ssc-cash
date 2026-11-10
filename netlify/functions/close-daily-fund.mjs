import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  bangkokBusinessDate,
  calculateCashBalance,
  canCloseDailyFund,
  toCents,
  validateBusinessDate,
} from "./domain.mjs";

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function adminServices() {
  const existing = getApps().find((app) => app.name === "netlify-daily-closing");
  if (existing) return { auth: getAuth(existing), db: getFirestore(existing) };

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable");

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON");
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required service account fields");
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  }, "netlify-daily-closing");
  return { auth: getAuth(app), db: getFirestore(app) };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function closeFund(db, uid, input, now) {
  if (typeof input.fundId !== "string" || !input.fundId || input.fundId.includes("/")) {
    throw new HttpError(400, "invalid-argument", "กรุณาเลือกงบค่าใช้จ่าย");
  }
  const countedCents = toCents(input.countedCash, "countedCash");
  if (countedCents < 0 || countedCents > 100000000000) {
    throw new HttpError(400, "invalid-argument", "ยอดเงินสดที่นับต้องอยู่ระหว่าง 0 ถึง 1,000,000,000 บาท");
  }
  if (typeof input.reason !== "string" || input.reason.trim().length > 1000) {
    throw new HttpError(400, "invalid-argument", "เหตุผลต้องเป็นข้อความไม่เกิน 1,000 ตัวอักษร");
  }
  const reason = input.reason.trim();
  const businessDate = validateBusinessDate(input.businessDate);
  const supersedesId = input.supersedesId == null ? null : input.supersedesId;
  if (supersedesId !== null && (typeof supersedesId !== "string" || !supersedesId)) {
    throw new HttpError(400, "invalid-argument", "รายการอ้างอิงไม่ถูกต้อง");
  }
  if (supersedesId && !reason) {
    throw new HttpError(400, "invalid-argument", "กรุณาระบุเหตุผลในการแก้ไขรายการปิดยอด");
  }

  const uidRef = db.doc(`users/${uid}`);
  const fundRef = db.doc(`funds/${input.fundId}`);
  const topupsQuery = db.collection("fundTopups").where("fundId", "==", input.fundId);
  const transactionsQuery = db.collection("transactions")
    .where("fundId", "==", input.fundId)
    .where("status", "==", "approved")
    .where("paymentMethod", "==", "cash");
  const closingsQuery = db.collection("dailyClosings").where("fundId", "==", input.fundId);

  return db.runTransaction(async (transaction) => {
    const [userSnapshot, fundSnapshot, topupsSnapshot, transactionsSnapshot, closingsSnapshot] =
      await Promise.all([
        transaction.get(uidRef),
        transaction.get(fundRef),
        transaction.get(topupsQuery),
        transaction.get(transactionsQuery),
        transaction.get(closingsQuery),
      ]);

    if (!userSnapshot.exists) throw new HttpError(403, "permission-denied", "ไม่พบข้อมูลผู้ใช้");
    const user = userSnapshot.data();
    if (!canCloseDailyFund(user)) {
      throw new HttpError(403, "permission-denied", "ไม่มีสิทธิ์ปิดยอดประจำวัน");
    }
    if (!fundSnapshot.exists) throw new HttpError(404, "not-found", "ไม่พบงบค่าใช้จ่ายที่เลือก");

    const fund = { id: fundSnapshot.id, ...fundSnapshot.data() };
    const closings = closingsSnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .filter((closing) => closing.businessDate === businessDate)
      .sort((a, b) => a.revision - b.revision);
    const latest = closings.at(-1) || null;

    let revision = 1;
    let expectedBalance;
    let balanceAsOf = now;
    let previous = null;
    if (supersedesId) {
      const previousSnapshot = await transaction.get(db.doc(`dailyClosings/${supersedesId}`));
      if (!previousSnapshot.exists) throw new HttpError(404, "not-found", "ไม่พบรายการปิดยอดที่อ้างอิง");
      previous = { id: previousSnapshot.id, ...previousSnapshot.data() };
      if (
        previous.fundId !== input.fundId ||
        previous.businessDate !== businessDate ||
        latest?.id !== previous.id
      ) throw new HttpError(409, "failed-precondition", "เลือกแก้ไขได้เฉพาะรายการปิดยอดล่าสุดของวันนั้น");
      revision = previous.revision + 1;
      expectedBalance = previous.expectedBalance;
      balanceAsOf = previous.balanceAsOf.toDate();
    } else {
      if (businessDate !== bangkokBusinessDate(now)) {
        throw new HttpError(400, "invalid-argument", "สร้างรายการปิดยอดใหม่ได้เฉพาะวันที่วันนี้");
      }
      if (latest) {
        throw new HttpError(409, "already-exists", "วันนี้ปิดยอดงบค่าใช้จ่ายนี้แล้ว ให้แก้ไขจากรายการล่าสุด");
      }
      expectedBalance = calculateCashBalance(
        fund,
        topupsSnapshot.docs.map((snapshot) => snapshot.data()),
        transactionsSnapshot.docs.map((snapshot) => snapshot.data()),
        now
      );
    }

    const differenceCents = countedCents - toCents(expectedBalance, "expectedBalance");
    if (!Number.isSafeInteger(differenceCents)) {
      throw new HttpError(422, "out-of-range", "ส่วนต่างสูงเกินช่วงที่ระบบรองรับ");
    }
    const difference = differenceCents / 100;
    if ((differenceCents !== 0 || supersedesId) && !reason) {
      throw new HttpError(
        422,
        "reason-required",
        "กรุณาระบุเหตุผลเมื่อยอดนับต่างจากระบบ หรือเมื่อแก้ไขรายการเดิม",
        { expectedBalance, difference }
      );
    }

    const closingRef = db.doc(`dailyClosings/${input.fundId}_${businessDate}_r${revision}`);
    const activityRef = db.doc(`activityLogs/daily-${closingRef.id}`);
    const createdAt = FieldValue.serverTimestamp();
    const closing = {
      fundId: input.fundId,
      fundLabel: fund.label,
      businessDate,
      expectedBalance,
      countedCash: countedCents / 100,
      difference,
      reason,
      revision,
      supersedesId: previous?.id || null,
      balanceAsOf: previous ? previous.balanceAsOf : createdAt,
      createdBy: uid,
      createdByName: typeof user.name === "string" ? user.name : "",
      createdAt,
    };
    const activity = {
      actorUid: uid,
      actorName: closing.createdByName,
      action: supersedesId ? "daily-closing-corrected" : "daily-closing-created",
      targetCollection: "dailyClosings",
      targetId: closingRef.id,
      before: previous ? {
        countedCash: previous.countedCash,
        difference: previous.difference,
        revision: previous.revision,
      } : null,
      after: {
        fundId: closing.fundId,
        businessDate: closing.businessDate,
        expectedBalance: closing.expectedBalance,
        countedCash: closing.countedCash,
        difference: closing.difference,
        revision: closing.revision,
        supersedesId: closing.supersedesId,
      },
      createdAt,
    };

    transaction.create(closingRef, closing);
    transaction.create(activityRef, activity);
    return {
      id: closingRef.id,
      ...closing,
      createdAt: now,
      balanceAsOf,
    };
  });
}

export default async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { code: "method-not-allowed", message: "รองรับเฉพาะ POST" });
  }

  const authorization = request.headers.get("authorization") || "";
  const tokenMatch = authorization.match(/^Bearer (.+)$/);
  if (!tokenMatch) return jsonResponse(401, { code: "unauthenticated", message: "กรุณาเข้าสู่ระบบ" });

  try {
    const { auth, db } = adminServices();
    const decodedToken = await auth.verifyIdToken(tokenMatch[1], true);
    const input = await request.json();
    const result = await closeFund(db, decodedToken.uid, input, new Date());
    return jsonResponse(200, result);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, {
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
    if (error instanceof TypeError || error instanceof RangeError || error instanceof SyntaxError) {
      return jsonResponse(400, { code: "invalid-argument", message: error.message });
    }
    if ([
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/argument-error",
      "auth/invalid-id-token",
    ].includes(error.code)) {
      return jsonResponse(401, { code: "unauthenticated", message: "กรุณาเข้าสู่ระบบใหม่" });
    }
    if (error.code === "auth/user-disabled") {
      return jsonResponse(403, { code: "permission-denied", message: "บัญชีนี้ถูกปิดใช้งาน" });
    }
    console.error("Netlify daily closing failed:", error);
    return jsonResponse(500, { code: "internal", message: "บันทึกปิดยอดไม่สำเร็จ กรุณาลองใหม่" });
  }
};

export { closeFund };
