import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { mergePlayerStates, normalizePlayerState } from "./player-state-merge";
import type { LocalPlayerState } from "./types";

export const SYNC_DEVICE_COOKIE = "ai_narrator_sync_device";
const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;
const PAIRING_TTL_SECONDS = 5 * 60;

type SupabaseRow<T> = T & Record<string, unknown>;

type DeviceRow = {
  id: string;
  profile_id: string;
  revoked_at?: string | null;
};

type StateRow = {
  profile_id: string;
  state: LocalPlayerState;
  updated_at: string;
};

type PairingRow = {
  id: string;
  profile_id: string;
  expires_at: string;
  used_at?: string | null;
};

export function isSyncConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function syncNotConfiguredResponse() {
  return NextResponse.json({ enabled: false, error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 200 });
}

function tokenHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function createDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

function createPairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function insertRow<T>(table: string, body: unknown): Promise<SupabaseRow<T>> {
  const rows = await supabaseFetch<SupabaseRow<T>[]>(table, { method: "POST", body: JSON.stringify(body) });
  if (!rows[0]) throw new Error(`No row returned from ${table}`);
  return rows[0];
}

async function patchRows<T>(path: string, body: unknown): Promise<SupabaseRow<T>[]> {
  return supabaseFetch<SupabaseRow<T>[]>(path, { method: "PATCH", body: JSON.stringify(body) });
}

async function getRows<T>(path: string): Promise<SupabaseRow<T>[]> {
  return supabaseFetch<SupabaseRow<T>[]>(path);
}

async function upsertState(profileId: string, state: LocalPlayerState): Promise<StateRow> {
  const rows = await supabaseFetch<StateRow[]>("sync_states?on_conflict=profile_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      profile_id: profileId,
      state,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!rows[0]) throw new Error("No state returned from Supabase");
  return rows[0];
}

async function getState(profileId: string): Promise<LocalPlayerState> {
  const rows = await getRows<StateRow>(`sync_states?profile_id=eq.${profileId}&select=state&limit=1`);
  return normalizePlayerState(rows[0]?.state);
}

async function setDeviceCookie(token: string) {
  const store = await cookies();
  store.set(SYNC_DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_MAX_AGE,
  });
}

export async function currentDevice(): Promise<DeviceRow | null> {
  const store = await cookies();
  const token = store.get(SYNC_DEVICE_COOKIE)?.value;
  if (!token) return null;
  const rows = await getRows<DeviceRow>(
    `sync_devices?token_hash=eq.${tokenHash(token)}&revoked_at=is.null&select=id,profile_id,revoked_at&limit=1`,
  );
  const device = rows[0] ?? null;
  if (device) {
    await patchRows<DeviceRow>(`sync_devices?id=eq.${device.id}`, { last_seen_at: new Date().toISOString() });
  }
  return device;
}

export async function createProfileWithDevice(stateInput: unknown) {
  const profile = await insertRow<{ id: string }>("sync_profiles", {});
  const token = createDeviceToken();
  const device = await insertRow<DeviceRow>("sync_devices", {
    profile_id: profile.id,
    token_hash: tokenHash(token),
    last_seen_at: new Date().toISOString(),
  });
  const state = normalizePlayerState(stateInput);
  const saved = await upsertState(profile.id, state);
  await setDeviceCookie(token);
  return { profileId: profile.id, deviceId: device.id, state: saved.state, syncedAt: saved.updated_at };
}

export async function readDeviceState(device: DeviceRow) {
  return getState(device.profile_id);
}

export async function mergeDeviceState(device: DeviceRow, stateInput: unknown, favoriteMode: "incoming" | "union" = "incoming") {
  const serverState = await getState(device.profile_id);
  const merged = mergePlayerStates(serverState, stateInput, favoriteMode);
  const saved = await upsertState(device.profile_id, merged);
  return { state: saved.state, syncedAt: saved.updated_at };
}

export async function startPairing(device: DeviceRow) {
  const code = createPairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000).toISOString();
  await insertRow<PairingRow>("sync_pairing_codes", {
    profile_id: device.profile_id,
    code_hash: tokenHash(code),
    expires_at: expiresAt,
  });
  return { code, expiresAt };
}

export async function claimPairing(codeInput: unknown, stateInput: unknown) {
  const code = typeof codeInput === "string" ? codeInput.replace(/\D/g, "") : "";
  if (code.length !== 6) throw new Error("Invalid pairing code");
  const rows = await getRows<PairingRow>(
    `sync_pairing_codes?code_hash=eq.${tokenHash(code)}&used_at=is.null&expires_at=gt.${new Date().toISOString()}&select=id,profile_id,expires_at,used_at&limit=1`,
  );
  const pairing = rows[0];
  if (!pairing) throw new Error("Pairing code is invalid or expired");
  await patchRows<PairingRow>(`sync_pairing_codes?id=eq.${pairing.id}`, { used_at: new Date().toISOString() });
  const token = createDeviceToken();
  const device = await insertRow<DeviceRow>("sync_devices", {
    profile_id: pairing.profile_id,
    token_hash: tokenHash(token),
    last_seen_at: new Date().toISOString(),
  });
  const serverState = await getState(pairing.profile_id);
  const merged = mergePlayerStates(serverState, stateInput, "union");
  const saved = await upsertState(pairing.profile_id, merged);
  await setDeviceCookie(token);
  return { profileId: pairing.profile_id, deviceId: device.id, state: saved.state, syncedAt: saved.updated_at };
}
