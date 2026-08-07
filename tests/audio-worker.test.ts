import assert from "node:assert/strict";
import test from "node:test";
import { createSignedAudioUrl } from "../src/lib/audio-url.ts";
import { handleAudioRequest, normalizeWorkerRange } from "../cloudflare/audio-worker/src/index.ts";

const secret = "test-audio-signing-secret-with-at-least-32-characters";
const signingEnvironment = {
  AUDIO_WORKER_URL: "https://audio.example.workers.dev",
  AUDIO_SIGNING_SECRET: secret,
  AUDIO_URL_TTL_SECONDS: "600",
};
const workerEnvironment = {
  AUDIO_SIGNING_SECRET: secret,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "reader@example.iam.gserviceaccount.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "unused-in-test",
  ALLOWED_ORIGINS: "https://ai-narrator-web-player.vercel.app",
  AUDIO_MAX_RANGE_BYTES: "4194304",
  MAX_SIGNED_URL_TTL_SECONDS: "86400",
};

test("Range 正規化支援 open-ended、suffix，並拒絕 multi-range", () => {
  assert.equal(normalizeWorkerRange(null), "bytes=0-4194303");
  assert.equal(normalizeWorkerRange("bytes=100-"), "bytes=100-4194403");
  assert.equal(normalizeWorkerRange("bytes=100-199"), "bytes=100-199");
  assert.equal(normalizeWorkerRange("bytes=-500"), "bytes=-500");
  assert.equal(normalizeWorkerRange("bytes=0-1,10-11"), null);
});

test("Worker 直接串流 Drive Range 並保留 206 標頭", async () => {
  const signed = createSignedAudioUrl("drive-file-1", Date.now(), signingEnvironment);
  let receivedRange = "";
  const response = await handleAudioRequest(new Request(signed.url, {
    headers: { range: "bytes=100-9999999", origin: "https://ai-narrator-web-player.vercel.app" },
  }), workerEnvironment, {
    getAccessToken: async () => "access-token",
    fetch: async (_input, init) => {
      receivedRange = new Headers(init?.headers).get("range") ?? "";
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: {
          "content-type": "audio/mpeg",
          "content-range": "bytes 100-4194403/9000000",
          "content-length": "4194304",
          "accept-ranges": "bytes",
        },
      });
    },
  });

  assert.equal(receivedRange, "bytes=100-4194403");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 100-4194403/9000000");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://ai-narrator-web-player.vercel.app");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
});

test("Worker 拒絕過期、竄改與不允許的 Origin", async () => {
  const expired = createSignedAudioUrl("drive-file-1", Date.now() - 3_600_000, signingEnvironment);
  const expiredResponse = await handleAudioRequest(new Request(expired.url), workerEnvironment);
  assert.equal(expiredResponse.status, 403);

  const signed = createSignedAudioUrl("drive-file-1", Date.now(), signingEnvironment);
  const tampered = new URL(signed.url);
  tampered.pathname = "/audio/drive-file-2";
  const tamperedResponse = await handleAudioRequest(new Request(tampered), workerEnvironment);
  assert.equal(tamperedResponse.status, 403);

  const wrongOriginResponse = await handleAudioRequest(new Request(signed.url, { headers: { origin: "https://attacker.example" } }), workerEnvironment);
  assert.equal(wrongOriginResponse.status, 403);
});
