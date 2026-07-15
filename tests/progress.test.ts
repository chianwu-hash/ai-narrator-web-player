import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_PLAYER_STATE, isEpisodeCompleted, resumePosition, toggleBookFavorite, toggleEpisodeFavorite, upsertProgress } from "../src/lib/progress-model.ts";

test("保存與恢復播放進度", () => {
  const state = upsertProgress(EMPTY_PLAYER_STATE, { episodeId: "ep1", bookId: "b1", position: 128, duration: 1200, lastPlayedAt: "2026-07-15T00:00:00Z" });
  assert.equal(state.lastEpisodeId, "ep1");
  assert.equal(resumePosition(state.progress.ep1), 126);
});

test("接近結尾標記完成並在重播時從頭開始", () => {
  assert.equal(isEpisodeCompleted(1190, 1200), true);
  const state = upsertProgress(EMPTY_PLAYER_STATE, { episodeId: "ep1", bookId: "b1", position: 1190, duration: 1200 });
  assert.equal(resumePosition(state.progress.ep1), 0);
});

test("整本與單集最愛可加入及移除", () => {
  const first = toggleEpisodeFavorite(toggleBookFavorite(EMPTY_PLAYER_STATE, "b1"), "ep1");
  assert.deepEqual(first.favoriteBookIds, ["b1"]);
  assert.deepEqual(first.favoriteEpisodeIds, ["ep1"]);
  const second = toggleEpisodeFavorite(toggleBookFavorite(first, "b1"), "ep1");
  assert.deepEqual(second.favoriteBookIds, []);
  assert.deepEqual(second.favoriteEpisodeIds, []);
});
