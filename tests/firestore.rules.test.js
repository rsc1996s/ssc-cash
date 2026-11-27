import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { deleteApp, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { archiveFund } from "../netlify/functions/archive-fund.mjs";

const projectId = "demo-cash-ledger";
let testEnv;
let adminApp;
let adminDb;
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

const validPhoto = "data:image/jpeg;base64,AAAA";

function transactionData(overrides = {}) {
  return {
    fundId: "fund-a",
    fundLabel: "หน้าร้าน",
    type: "expense",
    amount: 120,
    withdrawnAmount: 150,
    itemDescription: "ซื้อของ",
    changeAmount: 30,
    paymentMethod: "cash",
    category: "วัตถุดิบ",
    note: "",
    receiptPhotoURL: validPhoto,
    receiptPhotoURLs: [validPhoto],
    changePhotoURL: null,
    status: "pending",
    createdBy: "staff-a",
    createdByName: "พนักงาน",
    createdAt: serverTimestamp(),
    transactionDate: "2026-11-12",
    updatedAt: serverTimestamp(),
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNote: null,
    editHistory: [],
    ...overrides,
  };
}

function createTransaction(db, id, overrides = {}, fundUpdates = {}) {
  const data = transactionData(overrides);
  const batch = db.batch();
  batch.set(db.doc(`transactions/${id}`), data);
  batch.update(db.doc(`funds/${data.fundId}`), {
    lastCreatedTransactionId: id,
    transactionCreatedAt: serverTimestamp(),
    ...fundUpdates,
  });
  return batch.commit();
}

function evidenceBatch(firestore, uid, id, action, before, after, updates, auditOverrides = {}) {
  const batch = firestore.batch();
  const audit = firestore.collection("auditLogs").doc();
  const entry = {
    actorUid: uid,
    actorName: "ผู้ทดสอบ",
    action,
    targetCollection: "transactions",
    targetId: id,
    before: { status: before },
    after: { status: after },
    createdAt: serverTimestamp(),
    ...auditOverrides,
  };
  batch.update(firestore.doc(`transactions/${id}`), {
    ...updates, status: after, updatedAt: serverTimestamp(), auditLogId: audit.id,
  });
  batch.set(audit, entry);
  batch.set(firestore.doc(`activityLogs/${audit.id}`), entry);
  return batch;
}

function requestUpdates(uid = "owner-a", note = "กรุณาแนบใบเสร็จ") {
  return {
    evidenceRequestedBy: uid,
    evidenceRequestedByName: "ผู้ตรวจสอบ",
    evidenceRequestedAt: serverTimestamp(),
    evidenceRequestNote: note,
  };
}

function submitUpdates(photos = [validPhoto]) {
  return {
    receiptPhotoURL: photos[0] || null,
    receiptPhotoURLs: photos,
    evidenceSubmittedAt: serverTimestamp(),
  };
}

function voidBatch(db, uid, collection, id, before, reason = "ข้อมูลผิด", updates = {}, auditOverrides = {}) {
  const batch = db.batch();
  const audit = db.collection("auditLogs").doc();
  const isTopup = collection === "fundTopups";
  const after = isTopup
    ? { fundId: before.fundId, amount: before.amount, status: "voided", reason }
    : { status: "voided", reason };
  const entry = {
    actorUid: uid, actorName: "ผู้ทดสอบ",
    action: isTopup ? "fund-topup-voided" : "transaction-voided",
    targetCollection: collection, targetId: id, before, after, createdAt: serverTimestamp(),
    ...auditOverrides,
  };
  batch.update(db.doc(`${collection}/${id}`), {
    status: "voided", voidedBy: uid, voidedByName: "ผู้ทดสอบ",
    voidedAt: serverTimestamp(), voidReason: reason, auditLogId: audit.id,
    ...(!isTopup ? { updatedAt: serverTimestamp() } : {}), ...updates,
  });
  batch.set(audit, entry);
  batch.set(db.doc(`activityLogs/${audit.id}`), entry);
  return batch;
}

async function seedTransaction(id, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`transactions/${id}`).set(transactionData(overrides));
  });
}

async function seedData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await firestore.doc("meta/setup").set({
      ownerUid: "owner-a",
      ownerCount: 2,
      loginMode: "username",
    });

    for (const [uid, role, disabled] of [
      ["owner-a", "owner", false],
      ["owner-b", "owner", false],
      ["staff-a", "staff", false],
      ["staff-b", "staff", false],
      ["guest-a", "guest", false],
      ["disabled-a", "staff", true],
      ["pending-a", "pending", false],
    ]) {
      await firestore.doc(`users/${uid}`).set({
        name: uid,
        username: uid.replace("-", "."),
        role,
        disabled,
      });
    }

    await firestore.doc("funds/fund-a").set({
      label: "หน้าร้าน",
      openingBalance: 10000,
    });
    await firestore.doc("bankAccounts/source-a").set({
      side: "source",
      bankName: "ธนาคาร",
      accountNumber: "1234",
      accountName: "ร้าน",
      note: "",
    });
    await firestore.doc("pinDirectory/staff.a").set({
      uid: "staff-a",
      email: "staff@example.invalid",
    });
    await firestore.doc("pinDirectory/1234").set({
      uid: "staff-a",
      email: "staff@example.invalid",
    });
    await firestore.doc("transactions/approved-a").set(transactionData({
      status: "approved",
      createdBy: "staff-a",
      approvalSignatureURL: "data:image/png;base64,AAAA",
    }));
    await firestore.doc("transactions/pending-a").set(transactionData({
      createdBy: "staff-b",
    }));
    await firestore.doc("withdrawalRequests/withdrawal-a").set({
      requestNo: "WR-0001",
      sourceAccountId: "source-a",
      sourceAccountLabel: "ธนาคาร · 1234 (ร้าน)",
      date: "2026-10-06",
      note: "",
      lines: [{ lineNo: 1, categoryLabel: "ของ", description: "รายการ", amount: 100 }],
      totalAmount: 100,
      createdAt: new Date(),
      createdBy: "staff-a",
      createdByName: "พนักงาน",
      updatedAt: new Date(),
    });
  });
}

describe("Firestore rules", { concurrency: false }, () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
      },
    });
    adminApp = initializeAdminApp({ projectId }, "archive-rules-test");
    adminDb = getFirestore(adminApp);
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedData();
  });

  after(async () => {
    await testEnv?.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  test("guest reads only approved transactions and cannot write", async () => {
    const firestore = testEnv.authenticatedContext("guest-a").firestore();

    await assertSucceeds(firestore.doc("transactions/approved-a").get());
    await assertFails(firestore.doc("transactions/pending-a").get());
    await assertFails(createTransaction(firestore, "guest-write", {
      createdBy: "guest-a",
    }));
  });

  test("first owner bootstrap succeeds only in one atomic batch", async () => {
    await testEnv.clearFirestore();
    const firestore = testEnv.authenticatedContext("first-owner").firestore();
    const batch = firestore.batch();
    batch.set(firestore.doc("users/first-owner"), {
      name: "เจ้าของ",
      username: "first.owner",
      role: "owner",
      createdAt: serverTimestamp(),
    });
    batch.set(firestore.doc("pinDirectory/first.owner"), {
      uid: "first-owner",
      email: "first@example.invalid",
    });
    batch.set(firestore.doc("meta/setup"), {
      ownerUid: "first-owner",
      ownerCount: 1,
      loginMode: "username",
      ownerBootstrappedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());

    const secondFirestore = testEnv.authenticatedContext("second-owner").firestore();
    const secondBatch = secondFirestore.batch();
    secondBatch.set(secondFirestore.doc("users/second-owner"), {
      name: "เจ้าของคนที่สอง",
      username: "second.owner",
      role: "owner",
      createdAt: serverTimestamp(),
    });
    secondBatch.set(secondFirestore.doc("pinDirectory/second.owner"), {
      uid: "second-owner",
      email: "second@example.invalid",
    });
    secondBatch.set(secondFirestore.doc("meta/setup"), {
      ownerUid: "second-owner",
      ownerCount: 1,
      loginMode: "username",
      ownerBootstrappedAt: serverTimestamp(),
    });
    await assertFails(secondBatch.commit());
  });

  test("staff creates a valid pending transaction but cannot approve or read bank payments", async () => {
    const firestore = testEnv.authenticatedContext("staff-a").firestore();

    await assertSucceeds(createTransaction(firestore, "staff-new"));
    await assertFails(createTransaction(firestore, "staff-invalid-date", {
      transactionDate: "12/11/2026",
    }));
    await assertFails(createTransaction(firestore, "staff-negative", {
      amount: -10,
    }));
    await assertFails(firestore.doc("transactions/pending-a").update({
      status: "approved",
    }));
    await assertFails(firestore.doc("transferPayments/payment-a").get());
  });

  test("transaction creation and fund coordination must be atomic and cannot change fund data", async () => {
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    await assertFails(staff.doc("transactions/no-coordination").set(transactionData()));
    await assertFails(staff.doc("funds/fund-a").update({
      lastCreatedTransactionId: "missing", transactionCreatedAt: serverTimestamp(),
    }));
    await assertFails(createTransaction(staff, "tampered", {}, { openingBalance: 1 }));
    await assertFails(createTransaction(staff, "wrong-marker", {}, { lastCreatedTransactionId: "other" }));
    const batch = staff.batch();
    batch.set(staff.doc("transactions/first"), transactionData());
    batch.set(staff.doc("transactions/second"), transactionData());
    batch.update(staff.doc("funds/fund-a"), {
      lastCreatedTransactionId: "first", transactionCreatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
    await assertSucceeds(createTransaction(staff, "coordinated"));
  });

  test("fund top-up dates are optional, not future, and bound to the audit", async () => {
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    const past = new Date("2020-01-01T17:00:00Z");
    const future = new Date("2099-01-01T17:00:00Z");
    const createTopup = (db, uid, id, fields = {}, auditAfter, coordinate = true) => {
      const batch = db.batch();
      const audit = db.collection("auditLogs").doc();
      const after = auditAfter ?? { fundId: "fund-a", amount: 25, ...fields };
      const entry = {
        actorUid: uid, actorName: "ทดสอบ", action: "fund-topup-created",
        targetCollection: "fundTopups", targetId: id, before: null, after,
        createdAt: serverTimestamp(),
      };
      batch.set(db.doc(`fundTopups/${id}`), {
        fundId: "fund-a", amount: 25, note: "", createdBy: uid, createdByName: "ทดสอบ",
        createdAt: serverTimestamp(), auditLogId: audit.id, ...fields,
      });
      if (coordinate) {
        batch.update(db.doc("funds/fund-a"), {
          lastCreatedTopupId: id, topupCreatedAt: serverTimestamp(),
        });
      }
      batch.set(audit, entry);
      batch.set(db.doc(`activityLogs/${audit.id}`), entry);
      return batch.commit();
    };
    await assertSucceeds(createTopup(owner, "owner-a", "legacy"));
    await assertSucceeds(createTopup(owner, "owner-a", "dated", { topupDate: past }));
    await assertFails(createTopup(owner, "owner-a", "uncoordinated", {}, undefined, false));
    await assertFails(owner.doc("funds/fund-a").update({
      lastCreatedTopupId: "missing", topupCreatedAt: serverTimestamp(),
    }));
    await assertFails(createTopup(owner, "owner-a", "future", { topupDate: future }));
    await assertFails(createTopup(owner, "owner-a", "wrong-type", { topupDate: "2020-01-02" }));
    await assertFails(createTopup(owner, "owner-a", "wrong-audit", { topupDate: past }, { fundId: "fund-a", amount: 25 }));
    await assertFails(createTopup(staff, "staff-a", "staff", { topupDate: past }));
    await assertFails(owner.doc("fundTopups/no-audit").set({
      fundId: "fund-a", amount: 25, note: "", createdBy: "owner-a", createdByName: "ทดสอบ",
      createdAt: serverTimestamp(), topupDate: past, auditLogId: "missing",
    }));
    await assertFails(owner.doc("fundTopups/dated").update({ topupDate: past }));
  });

  test("actual receipts require owner and a matching audit; legacy requests remain editable", async () => {
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    const guest = testEnv.authenticatedContext("guest-a").firestore();
    const updateReceipt = (firestore, uid, amount, before = null, override = {}) => {
      const batch = firestore.batch();
      const audit = firestore.collection("auditLogs").doc();
      const entry = {
        actorUid: uid, actorName: "ทดสอบ", action: "withdrawal-received-changed",
        targetCollection: "withdrawalRequests", targetId: "withdrawal-a",
        before: { receivedAmount: before }, after: { receivedAmount: amount },
        createdAt: serverTimestamp(), ...override,
      };
      batch.update(firestore.doc("withdrawalRequests/withdrawal-a"), {
        receivedAmount: amount, updatedAt: serverTimestamp(), auditLogId: audit.id,
      });
      batch.set(audit, entry);
      batch.set(firestore.doc(`activityLogs/${audit.id}`), entry);
      return batch.commit();
    };
    await assertFails(staff.doc("withdrawalRequests/withdrawal-a").update({
      receivedAmount: 52400, updatedAt: serverTimestamp(),
    }));
    await assertFails(guest.doc("withdrawalRequests/withdrawal-a").update({
      receivedAmount: 52400, updatedAt: serverTimestamp(),
    }));
    await assertFails(owner.doc("withdrawalRequests/withdrawal-a").update({
      receivedAmount: 52400, updatedAt: serverTimestamp(), auditLogId: "missing",
    }));
    await assertFails(updateReceipt(owner, "owner-a", 52400, null, { after: { receivedAmount: 1 } }));
    await assertFails(updateReceipt(owner, "owner-a", -1));
    await assertSucceeds(updateReceipt(owner, "owner-a", 52400));
    await assertSucceeds(updateReceipt(owner, "owner-a", 52500, 52400));
    await assertSucceeds(staff.doc("withdrawalRequests/withdrawal-a").update({
      note: "แก้ไข", updatedAt: serverTimestamp(),
    }));
    await assertFails(staff.doc("withdrawalRequests/withdrawal-a").update({
      receivedAmount: 1, updatedAt: serverTimestamp(),
    }));
  });

  test("only owners may create origin bank accounts", async () => {
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    const account = (uid) => ({
      side: "origin", bankName: "ธนาคารทดสอบ", accountNumber: "1234",
      accountName: "ต้นทาง", note: "", createdBy: uid, createdAt: serverTimestamp(),
    });
    await assertSucceeds(owner.doc("bankAccounts/origin-a").set(account("owner-a")));
    await assertFails(staff.doc("bankAccounts/origin-b").set(account("staff-a")));
  });

  test("receipt audit and first transfer can be committed atomically", async () => {
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const audit = owner.collection("auditLogs").doc();
    const entry = {
      actorUid: "owner-a", actorName: "ทดสอบ", action: "withdrawal-received-changed",
      targetCollection: "withdrawalRequests", targetId: "withdrawal-a",
      before: { receivedAmount: null }, after: { receivedAmount: 52400 },
      createdAt: serverTimestamp(),
    };
    const batch = owner.batch();
    batch.update(owner.doc("withdrawalRequests/withdrawal-a"), {
      receivedAmount: 52400, auditLogId: audit.id, updatedAt: serverTimestamp(),
    });
    batch.set(audit, entry);
    batch.set(owner.doc(`activityLogs/${audit.id}`), entry);
    batch.set(owner.doc("transferPayments/payment-first"), {
      transferNo: "TP-0001", sourceAccountId: "source-a", sourceAccountLabel: "บัญชีทดสอบ",
      linkedWithdrawalRequestId: "withdrawal-a", linkedWithdrawalRequestNo: "WR-0001",
      lines: [{ lineNo: 1, amount: 50000, payeeAccountId: "payee-a" }],
      createdAt: serverTimestamp(), createdBy: "owner-a", createdByName: "ทดสอบ",
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    assert.equal((await owner.doc("withdrawalRequests/withdrawal-a").get()).data().receivedAmount, 52400);
  });

  test("transaction creation accepts zero to three valid photos only", async () => {
    const firestore = testEnv.authenticatedContext("staff-a").firestore();
    await assertSucceeds(createTransaction(firestore, "no-photo", {
      receiptPhotoURL: null, receiptPhotoURLs: [],
    }));
    await assertSucceeds(createTransaction(firestore, "three-photos", {
      receiptPhotoURLs: [validPhoto, validPhoto, validPhoto],
    }));
    for (const [id, overrides] of [
      ["wrong-empty", { receiptPhotoURL: validPhoto, receiptPhotoURLs: [] }],
      ["wrong-first", { receiptPhotoURL: null, receiptPhotoURLs: [validPhoto] }],
      ["four", { receiptPhotoURLs: Array(4).fill(validPhoto) }],
      ["bad-type", { receiptPhotoURL: "data:image/gif;base64,AAAA", receiptPhotoURLs: ["data:image/gif;base64,AAAA"] }],
      ["too-large", { receiptPhotoURL: `data:image/jpeg;base64,${"A".repeat(175000)}`, receiptPhotoURLs: [`data:image/jpeg;base64,${"A".repeat(175000)}`] }],
      ["wrong-status", { status: "needs_evidence" }],
    ]) await assertFails(createTransaction(firestore, id, overrides));
  });

  test("request, submission, and cancellation require matching audit and proper roles", async () => {
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    const other = testEnv.authenticatedContext("staff-b").firestore();
    const guest = testEnv.authenticatedContext("guest-a").firestore();
    const pending = testEnv.authenticatedContext("pending-a").firestore();
    await seedTransaction("evidence-a", { receiptPhotoURL: null, receiptPhotoURLs: [] });
    const request = (firestore, uid, updates = requestUpdates(uid), auditOverrides = {}) =>
      evidenceBatch(firestore, uid, "evidence-a", "transaction-evidence-requested", "pending", "needs_evidence", updates, auditOverrides);
    await assertFails(request(staff, "staff-a").commit());
    await assertFails(request(guest, "guest-a").commit());
    await assertFails(request(pending, "pending-a").commit());
    await assertFails(request(owner, "owner-a", requestUpdates("owner-a", "")).commit());
    await assertFails(request(owner, "owner-a", requestUpdates("owner-a", "x".repeat(2001))).commit());
    await assertFails(request(owner, "owner-a", { ...requestUpdates(), amount: 1 }).commit());
    await assertFails(request(owner, "owner-a", requestUpdates(), { after: { status: "approved" } }).commit());
    await assertFails(owner.doc("transactions/evidence-a").update({
      status: "needs_evidence", ...requestUpdates(), updatedAt: serverTimestamp(), auditLogId: "missing",
    }));
    await seedTransaction("owner-own", { createdBy: "owner-a" });
    await assertFails(evidenceBatch(owner, "owner-a", "owner-own", "transaction-evidence-requested", "pending", "needs_evidence", requestUpdates()).commit());
    await assertSucceeds(request(owner, "owner-a").commit());
    await assertFails(request(owner, "owner-a").commit());
    await assertFails(other.doc("transactions/evidence-a").get());
    const submit = (firestore, uid, updates = submitUpdates()) =>
      evidenceBatch(firestore, uid, "evidence-a", "transaction-evidence-submitted", "needs_evidence", "pending", updates);
    await assertFails(submit(other, "staff-b").commit());
    await assertFails(submit(guest, "guest-a").commit());
    await assertFails(submit(pending, "pending-a").commit());
    await assertFails(submit(staff, "staff-a", submitUpdates([])).commit());
    await assertFails(submit(staff, "staff-a", submitUpdates(["invalid"])).commit());
    await assertFails(submit(staff, "staff-a", { ...submitUpdates(), amount: 2 }).commit());
    await assertFails(submit(staff, "staff-a", { ...submitUpdates(), note: "แก้ไข" }).commit());
    await assertFails(staff.doc("transactions/evidence-a").update({
      ...submitUpdates(), status: "pending", updatedAt: serverTimestamp(), auditLogId: "missing",
    }));
    await assertSucceeds(submit(staff, "staff-a").commit());
    await assertFails(submit(staff, "staff-a").commit());
    await assertSucceeds(request(owner, "owner-a").commit());
    await assertFails(evidenceBatch(staff, "staff-a", "evidence-a", "transaction-evidence-request-cancelled", "needs_evidence", "pending", {}).commit());
    await assertFails(evidenceBatch(guest, "guest-a", "evidence-a", "transaction-evidence-request-cancelled", "needs_evidence", "pending", {}).commit());
    await assertFails(evidenceBatch(pending, "pending-a", "evidence-a", "transaction-evidence-request-cancelled", "needs_evidence", "pending", {}).commit());
    await assertFails(evidenceBatch(owner, "owner-a", "evidence-a", "transaction-evidence-request-cancelled", "needs_evidence", "pending", { amount: 1 }).commit());
    await assertSucceeds(evidenceBatch(owner, "owner-a", "evidence-a", "transaction-evidence-request-cancelled", "needs_evidence", "pending", {}).commit());
    await assertSucceeds(evidenceBatch(owner, "owner-a", "evidence-a", "transaction-status-changed", "pending", "approved", {
      reviewedBy: "owner-a", reviewedByName: "ผู้ตรวจสอบ", reviewedAt: serverTimestamp(),
      reviewNote: null, approvalSignatureURL: "data:image/png;base64,AAAA",
    }).commit());
  });

  test("needs-evidence transactions cannot be approved but can be rejected or voided", async () => {
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const review = (id, status) => evidenceBatch(owner, "owner-a", id, "transaction-status-changed", "needs_evidence", status, {
      reviewedBy: "owner-a", reviewedByName: "ผู้ตรวจสอบ", reviewedAt: serverTimestamp(),
      reviewNote: null, ...(status === "approved" ? { approvalSignatureURL: "data:image/png;base64,AAAA" } : {}),
    });
    for (const status of ["approved", "rejected"]) {
      const id = `review-${status}`;
      await seedTransaction(id, { status: "needs_evidence" });
      if (status === "approved") await assertFails(review(id, status).commit());
      else await assertSucceeds(review(id, status).commit());
    }
    await seedTransaction("review-voided", { status: "needs_evidence" });
    await assertFails(review("review-voided", "voided").commit());
    await assertSucceeds(voidBatch(owner, "owner-a", "transactions", "review-voided", { status: "needs_evidence" }).commit());
    await seedTransaction("oversize", {
      status: "needs_evidence", changePhotoURL: `data:image/jpeg;base64,${"A".repeat(174000)}`,
      approvalSignatureURL: `data:image/png;base64,${"A".repeat(99000)}`,
    });
    const largePhoto = `data:image/jpeg;base64,${"A".repeat(174000)}`;
    await assertFails(evidenceBatch(testEnv.authenticatedContext("staff-a").firestore(), "staff-a", "oversize",
      "transaction-evidence-submitted", "needs_evidence", "pending", submitUpdates([largePhoto, largePhoto, largePhoto])).commit());
    await seedTransaction("already-approved", { status: "approved" });
    await assertFails(evidenceBatch(testEnv.authenticatedContext("staff-a").firestore(), "staff-a", "already-approved",
      "transaction-evidence-submitted", "needs_evidence", "pending", submitUpdates()).commit());
    await seedTransaction("owner-submits", { status: "needs_evidence", createdBy: "owner-a" });
    await assertSucceeds(evidenceBatch(owner, "owner-a", "owner-submits",
      "transaction-evidence-submitted", "needs_evidence", "pending", submitUpdates()).commit());
  });

  test("only owners can void transactions and topups with matching audit and a reason", async () => {
      const owner = testEnv.authenticatedContext("owner-a").firestore();
      const staff = testEnv.authenticatedContext("staff-a").firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc("fundTopups/topup-a").set({
          fundId: "fund-a", amount: 25, note: "", createdBy: "owner-a",
          createdByName: "เจ้าของ", createdAt: new Date(), auditLogId: "old-audit",
        });
      });
      const txBefore = { status: "approved" };
      const topupBefore = { fundId: "fund-a", amount: 25, status: "active" };
      await assertFails(voidBatch(staff, "staff-a", "transactions", "approved-a", txBefore).commit());
      for (const uid of ["guest-a", "pending-a", "disabled-a"]) {
        const db = testEnv.authenticatedContext(uid).firestore();
        await assertFails(voidBatch(db, uid, "transactions", "approved-a", txBefore).commit());
        await assertFails(voidBatch(db, uid, "fundTopups", "topup-a", topupBefore).commit());
      }
      await assertFails(voidBatch(owner, "owner-a", "transactions", "approved-a", txBefore, "  \n").commit());
      await assertFails(voidBatch(owner, "owner-a", "transactions", "approved-a", txBefore, "x".repeat(1001)).commit());
      await assertFails(voidBatch(owner, "owner-a", "transactions", "approved-a", txBefore, "แก้ไข", { amount: 1 }).commit());
      await assertFails(voidBatch(owner, "owner-a", "transactions", "approved-a", txBefore, "แก้ไข", {}, { after: { status: "voided", reason: "อื่น" } }).commit());
      await assertFails(owner.doc("transactions/approved-a").update({
        status: "voided", voidedBy: "owner-a", voidedByName: "เจ้าของ", voidedAt: serverTimestamp(),
        voidReason: "ผิด", updatedAt: serverTimestamp(), auditLogId: "missing",
      }));
      await assertSucceeds(voidBatch(owner, "owner-a", "transactions", "approved-a", txBefore).commit());
      const tx = (await owner.doc("transactions/approved-a").get()).data();
      assert.equal(tx.approvalSignatureURL, "data:image/png;base64,AAAA");
      await assertFails(voidBatch(owner, "owner-a", "transactions", "approved-a", { status: "voided" }).commit());

      await assertFails(voidBatch(staff, "staff-a", "fundTopups", "topup-a", topupBefore).commit());
      await assertFails(voidBatch(owner, "owner-a", "fundTopups", "topup-a", topupBefore, "").commit());
      await assertFails(voidBatch(owner, "owner-a", "fundTopups", "topup-a", topupBefore, "ผิด", { amount: 100 }).commit());
      await assertFails(voidBatch(owner, "owner-a", "fundTopups", "topup-a", topupBefore, "ผิด", {}, { after: { ...topupBefore, status: "voided", reason: "อื่น" } }).commit());
      await assertSucceeds(voidBatch(owner, "owner-a", "fundTopups", "topup-a", topupBefore).commit());
      await assertFails(voidBatch(owner, "owner-a", "fundTopups", "topup-a", topupBefore).commit());
  });

  test("archived funds remain readable but reject new transactions and topups", async () => {
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const createTopup = (id) => {
      const batch = owner.batch();
      const audit = owner.collection("auditLogs").doc();
      const entry = {
        actorUid: "owner-a", actorName: "เจ้าของ", action: "fund-topup-created",
        targetCollection: "fundTopups", targetId: id, before: null,
        after: { fundId: "fund-a", amount: 25 }, createdAt: serverTimestamp(),
      };
      batch.set(owner.doc(`fundTopups/${id}`), {
        fundId: "fund-a", amount: 25, note: "", createdBy: "owner-a", createdByName: "เจ้าของ",
        createdAt: serverTimestamp(), auditLogId: audit.id,
      });
      batch.update(owner.doc("funds/fund-a"), {
        lastCreatedTopupId: id, topupCreatedAt: serverTimestamp(),
      });
      batch.set(audit, entry);
      batch.set(owner.doc(`activityLogs/${audit.id}`), entry);
      return batch.commit();
    };
    await assertSucceeds(createTransaction(staff, "before-archive"));
    await assertSucceeds(createTopup("before-archive"));
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc("funds/fund-a").update({ archived: true });
      });

    await assertSucceeds(staff.doc("funds/fund-a").get());
    await assertFails(createTransaction(staff, "new-archived"));
    await assertFails(createTopup("new-archived"));
    await assertFails(owner.doc("funds/fund-a").update({ archived: false }));
  });

  test("server archive checks pending items and atomically records its audit", async () => {
        await assert.rejects(archiveFund(adminDb, "staff-a", { fundId: "fund-a", reason: "เลิกใช้" }),
          (error) => error.status === 403);
        await assert.rejects(archiveFund(adminDb, "owner-a", { fundId: "fund-a", reason: "เลิกใช้" }),
          (error) => error.status === 409);
        await adminDb.doc("transactions/pending-a").update({ status: "approved" });
        await archiveFund(adminDb, "owner-a", { fundId: "fund-a", reason: "เลิกใช้" });
        const fund = (await adminDb.doc("funds/fund-a").get()).data();
        const audit = (await adminDb.doc(`auditLogs/${fund.auditLogId}`).get()).data();
        const activity = (await adminDb.doc(`activityLogs/${fund.auditLogId}`).get()).data();
        assert.equal(fund.archived, true);
        assert.equal(audit.after.reason, "เลิกใช้");
        assert.deepEqual(activity, audit);
  });

  test("concurrent creation cannot leave a pending transaction in an archived fund", async () => {
        const staff = testEnv.authenticatedContext("staff-a").firestore();
        for (let index = 0; index < 5; index += 1) {
          const fundId = `race-${index}`;
          await adminDb.doc(`funds/${fundId}`).set({ label: "ทดสอบ", openingBalance: 0 });
          const results = await Promise.allSettled([
            archiveFund(adminDb, "owner-a", { fundId, reason: "เลิกใช้" }),
            createTransaction(staff, fundId, { fundId }),
          ]);
          assert.ok(results.some((result) => result.status === "fulfilled"),
            `both operations failed: ${results.map((result) => result.reason?.message).join("; ")}`);
          const fund = (await adminDb.doc(`funds/${fundId}`).get()).data();
          const pending = await adminDb.collection("transactions").where("fundId", "==", fundId)
            .where("status", "==", "pending").get();
          assert.equal(pending.empty, results[1].status !== "fulfilled");
          assert.equal(fund.archived === true, results[0].status === "fulfilled");
          assert.equal(fund.archived === true && !pending.empty, false);
        }
  });

  test("owner approves a transaction atomically with its audit log", async () => {
    const firestore = testEnv.authenticatedContext("owner-a").firestore();
    const batch = firestore.batch();
    const audit = firestore.collection("auditLogs").doc();
    batch.update(firestore.doc("transactions/pending-a"), {
      status: "approved",
      reviewedBy: "owner-a",
      reviewedByName: "เจ้าของ",
      reviewedAt: serverTimestamp(),
      reviewNote: null,
      approvalSignatureURL: "data:image/png;base64,AAAA",
      updatedAt: serverTimestamp(),
      auditLogId: audit.id,
    });
    batch.set(audit, {
      actorUid: "owner-a",
      actorName: "เจ้าของ",
      action: "transaction-status-changed",
      targetCollection: "transactions",
      targetId: "pending-a",
      before: { status: "pending" },
      after: { status: "approved" },
      createdAt: serverTimestamp(),
    });
    batch.set(firestore.doc(`activityLogs/${audit.id}`), {
      actorUid: "owner-a",
      actorName: "เจ้าของ",
      action: "transaction-status-changed",
      targetCollection: "transactions",
      targetId: "pending-a",
      before: { status: "pending" },
      after: { status: "approved" },
      createdAt: serverTimestamp(),
    });

    test("owner approves five transfers with separate audit and activity records in one batch", async () => {
      const firestore = testEnv.authenticatedContext("owner-a").firestore();
      const ids = Array.from({ length: 5 }, (_, index) => `batch-receipt-${index}`);
      for (const id of ids) await seedTransaction(id, { type: "income", paymentMethod: "transfer", receiptPhotoURL: null, receiptPhotoURLs: [] });
      const batch = firestore.batch();
      for (const id of ids) {
        const audit = firestore.collection("auditLogs").doc();
        const entry = {
          actorUid: "owner-a", actorName: "เจ้าของ", action: "transaction-status-changed",
          targetCollection: "transactions", targetId: id, before: { status: "pending" },
          after: { status: "approved" }, createdAt: serverTimestamp(),
        };
        batch.update(firestore.doc(`transactions/${id}`), {
          status: "approved", reviewedBy: "owner-a", reviewedByName: "เจ้าของ",
          reviewedAt: serverTimestamp(), reviewNote: null,
          approvalSignatureURL: "data:image/png;base64,AAAA", updatedAt: serverTimestamp(), auditLogId: audit.id,
        });
        batch.set(audit, entry);
        batch.set(firestore.doc(`activityLogs/${audit.id}`), entry);
      }
      await assertSucceeds(batch.commit());
      for (const id of ids) assert.equal((await firestore.doc(`transactions/${id}`).get()).data().status, "approved");
    });

    test("staff can reconcile its own receipt id and cannot create it twice", async () => {
      const firestore = testEnv.authenticatedContext("staff-a").firestore();
      const data = { type: "income", paymentMethod: "transfer", receiptPhotoURL: null, receiptPhotoURLs: [] };
      await assertSucceeds(createTransaction(firestore, "receipt-retry", data));
      const own = await assertSucceeds(firestore.collection("transactions")
        .where("fundId", "==", "fund-a").where("createdBy", "==", "staff-a").get());
      assert.ok(own.docs.some((entry) => entry.id === "receipt-retry"));
      await assertFails(createTransaction(firestore, "receipt-retry", data));
    });

    await assertSucceeds(batch.commit());
    await assertSucceeds(firestore.doc(`activityLogs/${audit.id}`).get());
    await assertFails(testEnv.authenticatedContext("staff-a").firestore()
      .doc(`activityLogs/${audit.id}`).get());
  });

  test("transaction status cannot change without its append-only activity log", async () => {
    const firestore = testEnv.authenticatedContext("owner-a").firestore();
    const batch = firestore.batch();
    const audit = firestore.collection("auditLogs").doc();
    batch.update(firestore.doc("transactions/pending-a"), {
      status: "rejected",
      reviewedBy: "owner-a",
      reviewedByName: "เจ้าของ",
      reviewedAt: serverTimestamp(),
      reviewNote: "ขอข้อมูลเพิ่ม",
      updatedAt: serverTimestamp(),
      auditLogId: audit.id,
    });
    batch.set(audit, {
      actorUid: "owner-a",
      actorName: "เจ้าของ",
      action: "transaction-status-changed",
      targetCollection: "transactions",
      targetId: "pending-a",
      before: { status: "pending" },
      after: { status: "rejected" },
      createdAt: serverTimestamp(),
    });

    await assertFails(batch.commit());
  });

  test("owner cannot change own role or disable the last owner", async () => {
    const firestore = testEnv.authenticatedContext("owner-a").firestore();
    await assertFails(firestore.doc("users/owner-a").update({ role: "staff" }));

    const batch = firestore.batch();
    const audit = firestore.collection("auditLogs").doc();
    batch.update(firestore.doc("users/owner-b"), {
      role: "staff",
      disabled: false,
      auditLogId: audit.id,
    });
    batch.update(firestore.doc("meta/setup"), {
      ownerCount: 1,
      ownerChangeUserId: "owner-b",
    });
    batch.set(audit, {
      actorUid: "owner-a",
      actorName: "เจ้าของ",
      action: "role-changed",
      targetCollection: "users",
      targetId: "owner-b",
      before: { role: "owner", disabled: false },
      after: { role: "staff", disabled: false },
      createdAt: serverTimestamp(),
    });
    batch.set(firestore.doc(`activityLogs/${audit.id}`), {
      actorUid: "owner-a",
      actorName: "เจ้าของ",
      action: "role-changed",
      targetCollection: "users",
      targetId: "owner-b",
      before: { role: "owner", disabled: false },
      after: { role: "staff", disabled: false },
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());

    const secondBatch = firestore.batch();
    const secondAudit = firestore.collection("auditLogs").doc();
    secondBatch.update(firestore.doc("users/owner-a"), {
      role: "staff",
      disabled: false,
      auditLogId: secondAudit.id,
    });
    secondBatch.update(firestore.doc("meta/setup"), {
      ownerCount: 0,
      ownerChangeUserId: "owner-a",
    });
    secondBatch.set(secondAudit, {
      actorUid: "owner-b",
      actorName: "เจ้าของ",
      action: "role-changed",
      targetCollection: "users",
      targetId: "owner-a",
      before: { role: "owner", disabled: false },
      after: { role: "staff", disabled: false },
      createdAt: serverTimestamp(),
    });
    secondBatch.set(firestore.doc(`activityLogs/${secondAudit.id}`), {
      actorUid: "owner-b",
      actorName: "เจ้าของ",
      action: "role-changed",
      targetCollection: "users",
      targetId: "owner-a",
      before: { role: "owner", disabled: false },
      after: { role: "staff", disabled: false },
      createdAt: serverTimestamp(),
    });
    await assertFails(secondBatch.commit());
  });

  test("disabled users lose Firestore access and PIN directory cannot be listed", async () => {
    const disabledFirestore = testEnv.authenticatedContext("disabled-a").firestore();
    const unauthenticated = testEnv.unauthenticatedContext().firestore();

    await assertFails(disabledFirestore.doc("funds/fund-a").get());
    await assertSucceeds(unauthenticated.doc("pinDirectory/staff.a").get());
    await assertFails(unauthenticated.doc("pinDirectory/1234").get());
    await assertFails(unauthenticated.collection("pinDirectory").get());
  });

  test("audit logs cannot be edited or deleted", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await firestore.doc("auditLogs/old-entry").set({ action: "old" });
      await firestore.doc("activityLogs/old-entry").set({ action: "old" });
    });
    const firestore = testEnv.authenticatedContext("owner-a").firestore();
    await assertFails(firestore.doc("auditLogs/old-entry").update({ action: "changed" }));
    await assertFails(firestore.doc("auditLogs/old-entry").delete());
    await assertFails(firestore.doc("activityLogs/old-entry").update({ action: "changed" }));
    await assertFails(firestore.doc("activityLogs/old-entry").delete());
    await assertFails(testEnv.authenticatedContext("staff-a").firestore()
      .doc("activityLogs/old-entry").get());
    await assertFails(firestore.doc("activityLogs/forged").set({
      actorUid: "owner-a",
      actorName: "เจ้าของ",
      action: "role-changed",
      targetCollection: "users",
      targetId: "staff-a",
      before: { role: "staff", disabled: false },
      after: { role: "owner", disabled: false },
      createdAt: serverTimestamp(),
    }));
  });

  test("daily closing documents are owner-readable and cannot be written by clients", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("dailyClosings/fund-a_2026-11-07_r1").set({
        fundId: "fund-a",
        businessDate: "2026-11-07",
        expectedBalance: 10000,
        countedCash: 10000,
        difference: 0,
      });
    });

    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    const guest = testEnv.authenticatedContext("guest-a").firestore();
    const closing = {
      fundId: "fund-a",
      fundLabel: "หน้าร้าน",
      businessDate: "2026-11-07",
      expectedBalance: 10000,
      countedCash: 10000,
      difference: 0,
      reason: "",
      revision: 1,
      supersedesId: null,
      createdBy: "staff-a",
      createdByName: "พนักงาน",
      createdAt: serverTimestamp(),
      balanceAsOf: serverTimestamp(),
    };

    await assertSucceeds(owner.doc("dailyClosings/fund-a_2026-11-07_r1").get());
    await assertFails(staff.doc("dailyClosings/fund-a_2026-11-07_r1").get());
    await assertFails(guest.doc("dailyClosings/fund-a_2026-11-07_r1").get());
    await assertFails(owner.doc("dailyClosings/client-write").set(closing));
    await assertFails(staff.doc("dailyClosings/client-write").set(closing));
  });

  test("scoped fund reads and per-fund equality and in queries", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc("users/staff-a").update({ fundIds: ["fund-a"] });
      await db.doc("users/staff-b").update({ fundIds: ["fund-a", "fund-b"] });
      await db.doc("users/owner-a").update({ fundIds: [] });
      await db.doc("users/guest-a").update({ fundIds: ["fund-a"] });
      await db.doc("funds/fund-b").set({ label: "อื่น", openingBalance: 100 });
      await db.doc("fundTopups/a").set({ fundId: "fund-a", amount: 10 });
      await db.doc("fundTopups/b").set({ fundId: "fund-b", amount: 10 });
      await db.doc("transactions/b").set(transactionData({ fundId: "fund-b", status: "approved" }));
      await db.doc("transactions/own-a").set(transactionData({ status: "pending" }));
      await db.doc("transactions/own-a-evidence").set(transactionData({ status: "needs_evidence" }));
      await db.doc("transactions/own-b-evidence").set(transactionData({ fundId: "fund-b", status: "needs_evidence" }));
      await db.doc("transactions/own-b-pending").set(transactionData({ fundId: "fund-b" }));
    });
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    const guest = testEnv.authenticatedContext("guest-a").firestore();
    const both = testEnv.authenticatedContext("staff-b").firestore();
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    await assertSucceeds(staff.doc("funds/fund-a").get());
    await assertFails(staff.doc("funds/fund-b").get());
    await assertSucceeds(staff.doc("fundTopups/a").get());
    await assertFails(staff.doc("fundTopups/b").get());
    await assertSucceeds(staff.doc("transactions/approved-a").get());
    await assertSucceeds(staff.doc("transactions/own-a").get());
    await assertFails(staff.doc("transactions/b").get());
    await assertFails(createTransaction(staff, "write-b", { fundId: "fund-b" }));
    await assertSucceeds(createTransaction(staff, "write-a"));
    await assertSucceeds(staff.doc("transactions/own-a").update({
      amount: 130,
      updatedAt: serverTimestamp(),
      editHistory: [{ editedBy: "staff-a", reason: "แก้ไข" }],
    }));
    await assertSucceeds(evidenceBatch(staff, "staff-a", "own-a-evidence", "transaction-evidence-submitted",
      "needs_evidence", "pending", submitUpdates()).commit());
    await assertFails(staff.collection("funds").get());
    await assertFails(staff.collection("transactions").where("status", "==", "approved").get());
    await assertFails(staff.collection("fundTopups").get());
    await assertSucceeds(staff.collection("fundTopups").where("fundId", "==", "fund-a").get());
    await assertSucceeds(staff.collection("fundTopups").where("fundId", "in", ["fund-a"]).get());
    await assertSucceeds(staff.collection("transactions").where("fundId", "==", "fund-a").where("status", "==", "approved").get());
    await assertSucceeds(staff.collection("transactions").where("fundId", "==", "fund-a").where("createdBy", "==", "staff-a").get());
    await assertSucceeds(staff.collection("transactions").where("fundId", "in", ["fund-a"]).where("status", "==", "approved").get());
    await assertFails(staff.collection("transactions").where("fundId", "in", ["fund-a", "fund-b"]).where("status", "==", "approved").get());
    await assertSucceeds(both.collection("transactions").where("fundId", "in", ["fund-a", "fund-b"]).where("status", "==", "approved").get());
    await assertSucceeds(both.collection("fundTopups").where("fundId", "in", ["fund-a", "fund-b"]).get());
    await assertFails(evidenceBatch(staff, "staff-a", "own-b-evidence", "transaction-evidence-submitted",
      "needs_evidence", "pending", submitUpdates()).commit());
    await assertFails(staff.doc("transactions/own-b-pending").update({
      amount: 130,
      updatedAt: serverTimestamp(),
      editHistory: [{ editedBy: "staff-a", reason: "แก้ไข" }],
    }));
    await assertSucceeds(guest.doc("transactions/approved-a").get());
    await assertFails(guest.doc("transactions/b").get());
    await assertSucceeds(owner.doc("transactions/b").get());
    await assertSucceeds(owner.collection("funds").get());
    await assertSucceeds(owner.doc("transactions/b").update({
      amount: 130,
      updatedAt: serverTimestamp(),
      editHistory: [{ editedBy: "owner-a", reason: "แก้ไข" }],
    }));
  });

  test("legacy and empty fund assignments retain distinct access", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc("funds/fund-b").set({ label: "B", openingBalance: 0 });
      await db.doc("users/staff-b").update({ fundIds: [] });
      await db.doc("users/guest-a").update({ fundIds: [] });
    });

    const legacy = testEnv.authenticatedContext("staff-a").firestore();
    const emptyStaff = testEnv.authenticatedContext("staff-b").firestore();
    const emptyGuest = testEnv.authenticatedContext("guest-a").firestore();
    await assertSucceeds(legacy.doc("funds/fund-b").get());
    await assertSucceeds(legacy.collection("funds").get());
    await assertSucceeds(legacy.collection("transactions").where("status", "==", "approved").get());
    await assertFails(emptyStaff.doc("funds/fund-a").get());
    await assertFails(emptyStaff.doc("transactions/approved-a").get());
    await assertFails(createTransaction(emptyStaff, "own", { createdBy: "staff-b" }));
    await assertFails(emptyGuest.doc("funds/fund-a").get());
    await assertFails(emptyGuest.doc("transactions/approved-a").get());
  });

  test("staff assigned 30 funds can still create, edit and submit evidence", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc("users/staff-a").update({
        fundIds: ["fund-a", ...Array.from({ length: 29 }, (_, index) => `other-${index}`)],
      });
      await db.doc("transactions/max-pending").set(transactionData());
      await db.doc("transactions/max-evidence").set(transactionData({ status: "needs_evidence" }));
    });
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    await assertSucceeds(createTransaction(staff, "max-create"));
    await assertSucceeds(staff.doc("transactions/max-pending").update({
      amount: 130,
      updatedAt: serverTimestamp(),
      editHistory: [{ editedBy: "staff-a", reason: "แก้ไข" }],
    }));
    await assertSucceeds(evidenceBatch(staff, "staff-a", "max-evidence", "transaction-evidence-submitted",
      "needs_evidence", "pending", submitUpdates()).commit());
  });

  test("only owner may change another user's fund access with a matching audit", async () => {
    function accessBatch(db, uid, updates, before, after, withAudit = true) {
      const batch = db.batch();
      const audit = db.collection("auditLogs").doc();
      const entry = {
        actorUid: uid, actorName: "ทดสอบ", action: "user-access-changed",
        targetCollection: "users", targetId: "staff-a", before, after, createdAt: serverTimestamp(),
      };
      batch.update(db.doc("users/staff-a"), { ...updates, auditLogId: audit.id });
      if (withAudit) {
        batch.set(audit, entry);
        batch.set(db.doc(`activityLogs/${audit.id}`), entry);
      }
      return batch;
    }
    const owner = testEnv.authenticatedContext("owner-a").firestore();
    const staff = testEnv.authenticatedContext("staff-a").firestore();
    const before = { fundIds: null, roleLabel: null };
    const after = { fundIds: ["fund-a"], roleLabel: "หน้าร้าน" };
    await assertFails(accessBatch(owner, "owner-a", after, before, after, false).commit());
    await assertFails(accessBatch(owner, "owner-a", after, before, { ...after, roleLabel: "ผิด" }).commit());
    await assertFails(accessBatch(staff, "staff-a", after, before, after).commit());
    await assertFails(accessBatch(owner, "owner-a", { fundIds: [4], roleLabel: "" }, before, { fundIds: [4], roleLabel: "" }).commit());
    await assertFails(accessBatch(owner, "owner-a", { fundIds: "fund-a", roleLabel: "" }, before, { fundIds: "fund-a", roleLabel: "" }).commit());
    await assertFails(accessBatch(owner, "owner-a", { fundIds: ["fund-a"], roleLabel: "a".repeat(101) }, before,
      { fundIds: ["fund-a"], roleLabel: "a".repeat(101) }).commit());
    const tooMany = Array.from({ length: 31 }, (_, index) => `fund-${index}`);
    await assertFails(accessBatch(owner, "owner-a", { fundIds: tooMany, roleLabel: "" }, before, { fundIds: tooMany, roleLabel: "" }).commit());
    await assertSucceeds(accessBatch(owner, "owner-a", after, before, after).commit());
    const thirty = Array.from({ length: 30 }, (_, index) => `fund-${index}`);
    await assertSucceeds(accessBatch(owner, "owner-a", { fundIds: thirty, roleLabel: "" }, after, { fundIds: thirty, roleLabel: "" }).commit());
  });

  test("owner can create a scoped user with matching access audit while legacy creation still works", async () => {
    const db = testEnv.authenticatedContext("owner-a").firestore();
    function createUser(id, access, auditAfter) {
      const batch = db.batch();
      const audit = db.collection("auditLogs").doc();
      const entry = {
        actorUid: "owner-a", actorName: "เจ้าของ", action: "user-created",
        targetCollection: "users", targetId: id, before: null, after: auditAfter, createdAt: serverTimestamp(),
      };
      batch.set(db.doc(`users/${id}`), {
        name: "พนักงานใหม่", username: id, role: "staff", disabled: false,
        createdAt: serverTimestamp(), createdByOwner: "owner-a", auditLogId: audit.id, ...access,
      });
      batch.set(db.doc(`pinDirectory/${id}`), { uid: id, email: `${id}@example.invalid` });
      batch.set(audit, entry);
      batch.set(db.doc(`activityLogs/${audit.id}`), entry);
      return batch;
    }
    const access = { fundIds: ["fund-a"], roleLabel: "พนักงาน" };
    await assertFails(createUser("bad.new", access, { role: "staff", disabled: false }).commit());
    await assertSucceeds(createUser("scoped.new", access, { role: "staff", disabled: false, ...access }).commit());
    await assertSucceeds(createUser("legacy.new", {}, { role: "staff", disabled: false }).commit());
  });
});
