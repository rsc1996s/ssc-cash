import test from "node:test";
import assert from "node:assert/strict";
import { canRequestEvidence, canSubmitEvidence, evidencePhotos, evidenceSizeValid } from "../src/lib/evidence.js";

test("evidence transitions are limited to the reviewer and creator", () => {
  const pending = { status: "pending", createdBy: "staff" };
  const requested = { ...pending, status: "needs_evidence" };
  assert.equal(canRequestEvidence(pending, "owner", true), true);
  assert.equal(canRequestEvidence(pending, "staff", true), false);
  assert.equal(canRequestEvidence(requested, "owner", true), false);
  assert.equal(canSubmitEvidence(requested, "staff", true), true);
  assert.equal(canSubmitEvidence(requested, "other", true), false);
  assert.equal(canSubmitEvidence(requested, "staff", false), false);
  assert.equal(canSubmitEvidence(pending, "staff", true), false);
});

test("photo totals include the duplicated first photo and existing change photo", () => {
  assert.equal(evidencePhotos({ receiptPhotoURL: "old" }).length, 1);
  assert.deepEqual(evidencePhotos({ receiptPhotoURLs: [], receiptPhotoURL: null }), []);
  assert.equal(evidenceSizeValid([], null), true);
  assert.equal(evidenceSizeValid(["a".repeat(175001)]), false);
  assert.equal(evidenceSizeValid(Array(4).fill("a")), false);
  assert.equal(evidenceSizeValid(Array(3).fill("a".repeat(175000)), "a".repeat(175000)), true);
  assert.equal(evidenceSizeValid(Array(3).fill("a".repeat(175000)), "a".repeat(175000), "a".repeat(100000)), false);
});
