import { createHmac } from "node:crypto";
import type { Book } from "./types.ts";

const DEFAULT_TTL_SECONDS = 6 * 60 * 60;
const MIN_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

export type AudioDeliveryEnvironment = {
  [key: string]: string | undefined;
  AUDIO_WORKER_URL?: string;
  AUDIO_SIGNING_SECRET?: string;
  AUDIO_URL_TTL_SECONDS?: string;
};

function requireSigningSecret(env: AudioDeliveryEnvironment): string {
  const secret = env.AUDIO_SIGNING_SECRET ?? "";
  if (secret.length < 32) throw new Error("AUDIO_SIGNING_SECRET must contain at least 32 characters");
  return secret;
}

function workerBaseUrl(env: AudioDeliveryEnvironment): URL {
  const configured = env.AUDIO_WORKER_URL;
  if (!configured) throw new Error("AUDIO_WORKER_URL is not configured");
  const url = new URL(configured);
  const localDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("AUDIO_WORKER_URL must use HTTPS");
  }
  return url;
}

export function audioUrlTtlSeconds(env: AudioDeliveryEnvironment = process.env): number {
  const configured = Number(env.AUDIO_URL_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(configured)) return DEFAULT_TTL_SECONDS;
  return Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, Math.floor(configured)));
}

export function audioDeliveryConfigured(env: AudioDeliveryEnvironment = process.env): boolean {
  try {
    workerBaseUrl(env);
    requireSigningSecret(env);
    return true;
  } catch {
    return false;
  }
}

export function audioSignaturePayload(fileId: string, expiresAt: number): string {
  return `v1\n${fileId}\n${expiresAt}`;
}

export function signAudioRequest(fileId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(audioSignaturePayload(fileId, expiresAt)).digest("base64url");
}

export function createSignedAudioUrl(
  fileId: string,
  now = Date.now(),
  env: AudioDeliveryEnvironment = process.env,
): { url: string; expiresAt: string } {
  if (!fileId) throw new Error("fileId is required");
  const base = workerBaseUrl(env);
  const secret = requireSigningSecret(env);
  const expiresAtSeconds = Math.floor(now / 1000) + audioUrlTtlSeconds(env);
  const prefix = base.pathname.replace(/\/$/, "");
  base.pathname = `${prefix}/audio/${encodeURIComponent(fileId)}`;
  base.search = "";
  base.searchParams.set("exp", String(expiresAtSeconds));
  base.searchParams.set("sig", signAudioRequest(fileId, expiresAtSeconds, secret));
  return { url: base.toString(), expiresAt: new Date(expiresAtSeconds * 1000).toISOString() };
}

export function addAudioDeliveryUrls(
  books: Book[],
  now = Date.now(),
  env: AudioDeliveryEnvironment = process.env,
): Book[] {
  if (!audioDeliveryConfigured(env)) return books;
  return books.map((book) => ({
    ...book,
    episodes: book.episodes.map((episode) => ({
      ...episode,
      audioDelivery: createSignedAudioUrl(episode.id, now, env),
    })),
  }));
}
