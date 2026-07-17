import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

const ACTIVITY_DEVICE_COOKIE = "ai_narrator_activity_device";
const ACTIVITY_DEVICE_MAX_AGE = 60 * 60 * 24 * 365;

type DeviceKind = "mobile" | "tablet" | "desktop" | "unknown";

type DeviceActivityRow = {
  id: string;
  device_hash: string;
  device_kind: DeviceKind;
  browser_family: string;
  first_seen_at: string;
  last_seen_at: string;
};

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function tokenHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const url = `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function getActivityToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(ACTIVITY_DEVICE_COOKIE)?.value;
  if (existing) return existing;
  const token = randomBytes(32).toString("base64url");
  store.set(ACTIVITY_DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVITY_DEVICE_MAX_AGE,
  });
  return token;
}

function parseDeviceKind(userAgent: string): DeviceKind {
  const ua = userAgent.toLowerCase();
  if (!ua) return "unknown";
  if (ua.includes("ipad") || ua.includes("tablet")) return "tablet";
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) return "mobile";
  return "desktop";
}

function parseBrowserFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/") && !ua.includes("chromium/")) return "Safari";
  if (ua.includes("chrome/") || ua.includes("chromium/")) return "Chrome";
  return "Unknown";
}

function publicDevice(row: DeviceActivityRow) {
  return {
    id: row.id,
    deviceKind: row.device_kind,
    browserFamily: row.browser_family,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function deviceActivityAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function recordDeviceActivity() {
  const token = await getActivityToken();
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "";
  const now = new Date().toISOString();
  const rows = await supabaseFetch<DeviceActivityRow[]>("device_activity?on_conflict=device_hash", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      device_hash: tokenHash(token),
      device_kind: parseDeviceKind(userAgent),
      browser_family: parseBrowserFamily(userAgent),
      last_seen_at: now,
    }),
  });
  const row = rows[0];
  if (!row) throw new Error("No device activity returned from Supabase");
  return publicDevice(row);
}

export async function listAdminDeviceActivity() {
  const rows = await supabaseFetch<DeviceActivityRow[]>(
    "device_activity?select=id,device_hash,device_kind,browser_family,first_seen_at,last_seen_at&order=last_seen_at.desc&limit=500",
  );
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const devices = rows.map(publicDevice);
  return {
    total: devices.length,
    active24h: devices.filter((device) => now - Date.parse(device.lastSeenAt) <= dayMs).length,
    active7d: devices.filter((device) => now - Date.parse(device.lastSeenAt) <= 7 * dayMs).length,
    devices,
  };
}
