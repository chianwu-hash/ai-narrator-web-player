import assert from "node:assert/strict";
import test from "node:test";
import { driveErrorMessage, normalizeAudioRange } from "../src/lib/google-drive.ts";

test("Drive API 錯誤提供可理解訊息", () => {
  assert.match(driveErrorMessage(403), /授權失敗/);
  assert.match(driveErrorMessage(429), /稍後再試/);
});

test("音訊 Range 限制在 4 MiB 內", () => {
  assert.equal(normalizeAudioRange(undefined), "bytes=0-4194303");
  assert.equal(normalizeAudioRange("bytes=4194304-"), "bytes=4194304-8388607");
  assert.equal(normalizeAudioRange("bytes=100-199"), "bytes=100-199");
});
