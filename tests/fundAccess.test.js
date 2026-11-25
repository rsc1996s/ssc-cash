import assert from "node:assert/strict";
import { test } from "node:test";
import { canViewFund } from "../src/lib/fundAccess.js";

test("fund access distinguishes legacy, empty, scoped and owner profiles", () => {
  assert.equal(canViewFund({ role: "staff" }, "b"), true);
  assert.equal(canViewFund({ role: "staff", fundIds: [] }, "a"), false);
  assert.equal(canViewFund({ role: "staff", fundIds: ["a"] }, "a"), true);
  assert.equal(canViewFund({ role: "staff", fundIds: ["a"] }, "b"), false);
  assert.equal(canViewFund({ role: "guest", fundIds: ["a"] }, "b"), false);
  assert.equal(canViewFund({ role: "owner", fundIds: [] }, "b"), true);
  assert.equal(canViewFund({ role: "staff", fundIds: null }, "a"), false);
  assert.equal(canViewFund({ role: "staff", disabled: true }, "a"), false);
});
