import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type AuthEnvironment = {
  [key: string]: string | undefined;
  APP_ACCESS_CODE?: string;
  APP_ACCESS_CODE_SHA256?: string;
  SESSION_SECRET?: string;
  AUTH_VERSION?: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function configuredCodeHash(env: AuthEnvironment): string {
  if (env.APP_ACCESS_CODE_SHA256) return env.APP_ACCESS_CODE_SHA256.trim().toLowerCase();
  if (env.APP_ACCESS_CODE) return sha256(env.APP_ACCESS_CODE);
  return "";
}

export function verifyAccessCode(candidate: string, env: AuthEnvironment = process.env): boolean {
  const expected = configuredCodeHash(env);
  return Boolean(candidate && expected && safeEqual(sha256(candidate), expected));
}

export function sessionVersion(env: AuthEnvironment = process.env): string {
  return sha256(`${configuredCodeHash(env)}:${env.AUTH_VERSION ?? "1"}`).slice(0, 24);
}

function secret(env: AuthEnvironment): string {
  return env.SESSION_SECRET ?? "";
}

export function createSessionToken(now = Date.now(), env: AuthEnvironment = process.env): string {
  if (!secret(env)) throw new Error("SESSION_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({ v: sessionVersion(env), exp: Math.floor(now / 1000) + SESSION_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", secret(env)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now(), env: AuthEnvironment = process.env): boolean {
  if (!token || !secret(env) || !configuredCodeHash(env)) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", secret(env)).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: string; exp?: number };
    return parsed.v === sessionVersion(env) && typeof parsed.exp === "number" && parsed.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export const sessionMaxAge = SESSION_SECONDS;
