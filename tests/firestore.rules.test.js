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

const projectId = "demo-cash-ledger";
let testEnv;
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
    updatedAt: serverTimestamp(),
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNote: null,
    editHistory: [],
    ...overrides,
  };
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
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedData();
  });

  after(async () => {
    await testEnv?.cleanup();
  });

  test("guest reads only approved transactions and cannot write", async () => {
    const firestore = testEnv.authenticatedContext("guest-a").firestore();

    await assertSucceeds(firestore.doc("transactions/approved-a").get());
    await assertFails(firestore.doc("transactions/pending-a").get());
    await assertFails(firestore.doc("transactions/guest-write").set(transactionData({
      createdBy: "guest-a",
    })));
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

    await assertSucceeds(firestore.doc("transactions/staff-new").set(transactionData()));
    await assertFails(firestore.doc("transactions/staff-negative").set(transactionData({
      amount: -10,
    })));
    await assertFails(firestore.doc("transactions/pending-a").update({
      status: "approved",
    }));
    await assertFails(firestore.doc("transferPayments/payment-a").get());
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
      await context.firestore().doc("auditLogs/old-entry").set({ action: "old" });
      await context.firestore().doc("activityLogs/old-entry").set({ action: "old" });
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
});
