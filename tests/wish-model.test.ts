import assert from "node:assert/strict";
import test from "node:test";
import { validateBookWish } from "../src/lib/wish-model.ts";

test("validates an anonymous book wish", () => {
  const result = validateBookWish({
    title: " 原子習慣 ",
    author: " James Clear ",
    reason: "想聽這本書的習慣養成方法。",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, "原子習慣");
    assert.equal(result.value.author, "James Clear");
  }
});

test("book wish author is optional", () => {
  const result = validateBookWish({
    title: "深度工作",
    reason: "想知道如何安排專注時間。",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.author, undefined);
});

test("rejects malformed book wishes", () => {
  assert.equal(validateBookWish({ title: "", reason: "想聽" }).ok, false);
  assert.equal(validateBookWish({ title: "書", reason: "abc" }).ok, false);
  assert.equal(validateBookWish(null).ok, false);
});
