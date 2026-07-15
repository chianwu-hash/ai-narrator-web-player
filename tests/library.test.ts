import assert from "node:assert/strict";
import test from "node:test";
import { coverKind, extractEpisodeNumber, indexBookFolder, isAllowedAudio } from "../src/lib/library.ts";

const folder = { id: "book", name: "測試書", mimeType: "application/vnd.google-apps.folder" };

test("解析集數並使用數字排序", () => {
  assert.equal(extractEpisodeNumber("EP10_終章.mp3"), 10);
  assert.equal(extractEpisodeNumber("第 2 集 開始.m4a"), 2);
  const book = indexBookFolder(folder, [
    { id: "10", name: "EP10_終章.mp3", mimeType: "audio/mpeg" },
    { id: "2", name: "EP02_展開.mp3", mimeType: "audio/mpeg" },
  ]);
  assert.deepEqual(book?.episodes.map((episode) => episode.number), [2, 10]);
});

test("排除非書籍音訊並辨識有效書籍資料夾", () => {
  assert.equal(isAllowedAudio({ id: "x", name: "開場音樂.mp3", mimeType: "audio/mpeg" }), false);
  assert.equal(isAllowedAudio({ id: "y", name: "EP01_第一章.mp3", mimeType: "audio/mpeg" }), true);
  assert.equal(indexBookFolder(folder, [{ id: "x", name: "test.mp3", mimeType: "audio/mpeg" }]), null);
});

test("沒有封面時使用降級封面", () => {
  const book = indexBookFolder(folder, [{ id: "1", name: "EP01_開始.mp3", mimeType: "audio/mpeg" }]);
  assert.ok(book);
  assert.equal(coverKind(book), "fallback");
});
