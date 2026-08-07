import assert from "node:assert/strict";
import test from "node:test";
import { nextSyncUploadDelay, SYNC_UPLOAD_DEBOUNCE_MS, SYNC_UPLOAD_MIN_INTERVAL_MS } from "../src/lib/sync-upload.ts";

test("首次同步只做短 debounce，連續播放進度最多每分鐘上傳一次", () => {
  assert.equal(nextSyncUploadDelay(0, 1_000_000), SYNC_UPLOAD_DEBOUNCE_MS);
  assert.equal(nextSyncUploadDelay(1_000_000, 1_005_000), SYNC_UPLOAD_MIN_INTERVAL_MS - 5_000);
  assert.equal(nextSyncUploadDelay(1_000_000, 1_061_000), SYNC_UPLOAD_DEBOUNCE_MS);
});
