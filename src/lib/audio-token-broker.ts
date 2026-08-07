import { createHash, timingSafeEqual } from "node:crypto";

export type AudioTokenBrokerEnvironment = {
  AUDIO_TOKEN_BROKER_SECRET?: string;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function audioTokenBrokerConfigured(
  env: AudioTokenBrokerEnvironment = { AUDIO_TOKEN_BROKER_SECRET: process.env.AUDIO_TOKEN_BROKER_SECRET },
): boolean {
  return (env.AUDIO_TOKEN_BROKER_SECRET?.length ?? 0) >= 32;
}

export function authorizeAudioTokenBroker(
  authorization: string | null,
  env: AudioTokenBrokerEnvironment = { AUDIO_TOKEN_BROKER_SECRET: process.env.AUDIO_TOKEN_BROKER_SECRET },
): boolean {
  const secret = env.AUDIO_TOKEN_BROKER_SECRET ?? "";
  if (secret.length < 32 || !authorization?.startsWith("Bearer ")) return false;
  const candidate = authorization.slice("Bearer ".length);
  return timingSafeEqual(digest(candidate), digest(secret));
}
