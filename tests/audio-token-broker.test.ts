import assert from "node:assert/strict";
import test from "node:test";
import { audioTokenBrokerConfigured, authorizeAudioTokenBroker } from "../src/lib/audio-token-broker.ts";

const secret = "broker-test-secret-with-at-least-32-characters";

test("token broker 只接受完全相同的 Bearer secret", () => {
  const env = { AUDIO_TOKEN_BROKER_SECRET: secret };
  assert.equal(audioTokenBrokerConfigured(env), true);
  assert.equal(authorizeAudioTokenBroker(`Bearer ${secret}`, env), true);
  assert.equal(authorizeAudioTokenBroker(`Bearer ${secret}x`, env), false);
  assert.equal(authorizeAudioTokenBroker(null, env), false);
});

test("token broker 拒絕過短或未設定的 secret", () => {
  assert.equal(audioTokenBrokerConfigured({ AUDIO_TOKEN_BROKER_SECRET: "short" }), false);
  assert.equal(authorizeAudioTokenBroker("Bearer short", { AUDIO_TOKEN_BROKER_SECRET: "short" }), false);
});
