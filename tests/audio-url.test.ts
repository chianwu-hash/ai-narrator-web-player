import assert from "node:assert/strict";
import test from "node:test";
import { addAudioDeliveryUrls, createSignedAudioUrl } from "../src/lib/audio-url.ts";
import { verifyAudioSignature } from "../cloudflare/audio-worker/src/index.ts";

const secret = "test-audio-signing-secret-with-at-least-32-characters";
const environment = {
  AUDIO_WORKER_URL: "https://audio.example.workers.dev",
  AUDIO_SIGNING_SECRET: secret,
  AUDIO_URL_TTL_SECONDS: "600",
};

test("Vercel 與 Worker 使用相同的短效 HMAC 格式", async () => {
  const now = Date.UTC(2026, 7, 7, 0, 0, 0);
  const signed = createSignedAudioUrl("drive-file-1", now, environment);
  const url = new URL(signed.url);
  const expiresAt = Number(url.searchParams.get("exp"));
  const signature = url.searchParams.get("sig") ?? "";

  assert.equal(url.pathname, "/audio/drive-file-1");
  assert.equal(await verifyAudioSignature("drive-file-1", expiresAt, signature, secret, now / 1000), true);
  assert.equal(await verifyAudioSignature("drive-file-2", expiresAt, signature, secret, now / 1000), false);
  assert.equal(await verifyAudioSignature("drive-file-1", expiresAt, `${signature}x`, secret, now / 1000), false);
  assert.equal(await verifyAudioSignature("drive-file-1", expiresAt, signature, secret, expiresAt), false);
});

test("書庫只在完整設定後加入簽章 URL", () => {
  const books = [{
    id: "book-1",
    title: "Book",
    episodes: [{ id: "drive-file-1", bookId: "book-1", number: 1, title: "EP1", fileName: "ep1.mp3", mimeType: "audio/mpeg" }],
  }];
  assert.equal(addAudioDeliveryUrls(books, 0, {}).at(0)?.episodes.at(0)?.audioDelivery, undefined);
  assert.match(addAudioDeliveryUrls(books, 0, environment).at(0)?.episodes.at(0)?.audioDelivery?.url ?? "", /^https:\/\/audio\.example\.workers\.dev\/audio\//);
});
