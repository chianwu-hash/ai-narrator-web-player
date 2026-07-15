import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, verifyAccessCode, verifySessionToken } from "../src/lib/auth-core.ts";

const base = { APP_ACCESS_CODE: "correct horse", SESSION_SECRET: "a-secret-that-is-definitely-longer-than-32-characters", AUTH_VERSION: "1" };

test("正確與錯誤認證碼", () => {
  assert.equal(verifyAccessCode("correct horse", base), true);
  assert.equal(verifyAccessCode("wrong", base), false);
});

test("認證版本或認證碼改變後舊 session 失效", () => {
  const token = createSessionToken(1_000, base);
  assert.equal(verifySessionToken(token, 2_000, base), true);
  assert.equal(verifySessionToken(token, 2_000, { ...base, AUTH_VERSION: "2" }), false);
  assert.equal(verifySessionToken(token, 2_000, { ...base, APP_ACCESS_CODE: "new code" }), false);
});
