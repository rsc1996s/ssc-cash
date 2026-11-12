import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch, normalizeSearchText } from "../src/components/ui/searchText.js";

test("normalizes Thai text, whitespace, invisible characters, and Unicode NFC", () => {
  assert.equal(normalizeSearchText("  ค่\u200bา   อาหาร  "), "ค่า อาหาร");
  assert.equal(matchesSearch("เก\u0e35\u0e48ยว", "เกี่ยว"), true);
});

test("matches any substring and all query terms independent of order", () => {
  assert.equal(matchesSearch("ข้าว 123", "ธนาคารไทย · บัญชีข้าวสาร 123-456"), true);
  assert.equal(matchesSearch("บัญชี ข้าว", "ข้าวสาร บัญชีธนาคาร"), true);
  assert.equal(matchesSearch("บัญชี ไม่พบ", "ข้าวสาร บัญชีธนาคาร"), false);
});

test("matches account numbers with or without hyphens", () => {
  assert.equal(matchesSearch("12345678", "1234-5678"), true);
  assert.equal(matchesSearch("1234-5678", "12345678"), true);
});

test("returns all options for an empty query", () => {
  assert.equal(matchesSearch("   ", "ข้อความตัวอย่าง"), true);
});
