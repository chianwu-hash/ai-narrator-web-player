import assert from "node:assert/strict";
import test from "node:test";
import { adminAuthConfigured, createAdminSessionToken, verifyAdminAccessCode, verifyAdminSessionToken } from "../src/lib/admin-auth-core.ts";
import { createSessionToken } from "../src/lib/auth-core.ts";

const adminEnv = {
  ADMIN_ACCESS_CODE: "admin secret",
  SESSION_SECRET: "a-secret-that-is-definitely-longer-than-32-characters",
  ADMIN_AUTH_VERSION: "1",
};

test("verifies admin access code", () => {
  assert.equal(adminAuthConfigured(adminEnv), true);
  assert.equal(verifyAdminAccessCode("admin secret", adminEnv), true);
  assert.equal(verifyAdminAccessCode("wrong", adminEnv), false);
});

test("admin session is separate from listener session", () => {
  const adminToken = createAdminSessionToken(1_000, adminEnv);
  assert.equal(verifyAdminSessionToken(adminToken, 2_000, adminEnv), true);

  const listenerToken = createSessionToken(1_000, {
    APP_ACCESS_CODE: "admin secret",
    SESSION_SECRET: adminEnv.SESSION_SECRET,
    AUTH_VERSION: "1",
  });
  assert.equal(verifyAdminSessionToken(listenerToken, 2_000, adminEnv), false);
});

test("changing admin auth version expires old admin sessions", () => {
  const token = createAdminSessionToken(1_000, adminEnv);
  assert.equal(verifyAdminSessionToken(token, 2_000, { ...adminEnv, ADMIN_AUTH_VERSION: "2" }), false);
});
