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

test("重複暫停或切背景的相同進度不刷新同步時間", () => {
  const input = { episodeId: "ep1", bookId: "b1", position: 128, duration: 1200 };
  const state = upsertProgress(EMPTY_PLAYER_STATE, { ...input, lastPlayedAt: "2026-07-15T00:00:00Z" });
  assert.equal(upsertProgress(state, input), state);
  assert.equal(state.progress.ep1.lastPlayedAt, "2026-07-15T00:00:00Z");
});

test("倒帶與完成事件仍更新進度，同位置切回另一集也保留事件", () => {
  const state = upsertProgress(EMPTY_PLAYER_STATE, { episodeId: "ep1", bookId: "b1", position: 128, duration: 1200, lastPlayedAt: "2026-07-15T00:00:00Z" });
  const rewound = upsertProgress(state, { episodeId: "ep1", bookId: "b1", position: 100, duration: 1200 });
  assert.equal(rewound.progress.ep1.position, 100);
  assert.notEqual(rewound.progress.ep1.lastPlayedAt, state.progress.ep1.lastPlayedAt);
  const completed = upsertProgress(state, { episodeId: "ep1", bookId: "b1", position: 128, duration: 1200, completed: true });
  assert.equal(completed.progress.ep1.completed, true);
  const another = upsertProgress(state, { episodeId: "ep2", bookId: "b1", position: 0, duration: 1200 });
  const returned = upsertProgress(another, { episodeId: "ep1", bookId: "b1", position: 128, duration: 1200 });
  assert.equal(returned.lastEpisodeId, "ep1");
  assert.notEqual(returned, another);
});

test("外部明確提供的時間戳不被相同進度判斷忽略", () => {
  const input = { episodeId: "ep1", bookId: "b1", position: 128, duration: 1200 };
  const state = upsertProgress(EMPTY_PLAYER_STATE, { ...input, lastPlayedAt: "2026-07-15T00:00:00Z" });
  const updated = upsertProgress(state, { ...input, lastPlayedAt: "2026-07-16T00:00:00Z" });
  assert.equal(updated.progress.ep1.lastPlayedAt, "2026-07-16T00:00:00Z");
});
