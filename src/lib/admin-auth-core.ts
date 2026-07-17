import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 7;

export type AdminAuthEnvironment = {
  [key: string]: string | undefined;
  ADMIN_ACCESS_CODE?: string;
  ADMIN_ACCESS_CODE_SHA256?: string;
  ADMIN_AUTH_VERSION?: string;
  SESSION_SECRET?: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function configuredAdminCodeHash(env: AdminAuthEnvironment): string {
  if (env.ADMIN_ACCESS_CODE_SHA256) return env.ADMIN_ACCESS_CODE_SHA256.trim().toLowerCase();
  if (env.ADMIN_ACCESS_CODE) return sha256(env.ADMIN_ACCESS_CODE);
  return "";
}

function secret(env: AdminAuthEnvironment): string {
  return env.SESSION_SECRET ?? "";
}

export function adminAuthConfigured(env: AdminAuthEnvironment = process.env): boolean {
  return Boolean(secret(env) && configuredAdminCodeHash(env));
}

export function verifyAdminAccessCode(candidate: string, env: AdminAuthEnvironment = process.env): boolean {
  const expected = configuredAdminCodeHash(env);
  return Boolean(candidate && expected && safeEqual(sha256(candidate), expected));
}

export function adminSessionVersion(env: AdminAuthEnvironment = process.env): string {
  return sha256(`${configuredAdminCodeHash(env)}:${env.ADMIN_AUTH_VERSION ?? "1"}:admin`).slice(0, 24);
}

export function createAdminSessionToken(now = Date.now(), env: AdminAuthEnvironment = process.env): string {
  if (!adminAuthConfigured(env)) throw new Error("Admin auth is not configured");
  const payload = Buffer.from(JSON.stringify({
    scope: "admin",
    v: adminSessionVersion(env),
    exp: Math.floor(now / 1000) + ADMIN_SESSION_SECONDS,
  })).toString("base64url");
  const signature = createHmac("sha256", secret(env)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined, now = Date.now(), env: AdminAuthEnvironment = process.env): boolean {
  if (!token || !adminAuthConfigured(env)) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", secret(env)).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { scope?: string; v?: string; exp?: number };
    return parsed.scope === "admin"
      && parsed.v === adminSessionVersion(env)
      && typeof parsed.exp === "number"
      && parsed.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export const adminSessionMaxAge = ADMIN_SESSION_SECONDS;
