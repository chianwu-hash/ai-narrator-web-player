import assert from "node:assert/strict";
import test from "node:test";
import { mergePlayerStates, normalizePlayerState } from "../src/lib/player-state-merge.ts";
import type { LocalPlayerState } from "../src/lib/types.ts";

const baseState: LocalPlayerState = {
  progress: {
    ep1: {
      episodeId: "ep1",
      bookId: "book1",
      position: 10,
      duration: 100,
      completed: false,
      lastPlayedAt: "2026-07-17T00:00:00.000Z",
    },
  },
  favoriteBookIds: ["book1"],
  favoriteEpisodeIds: ["ep1"],
  playbackRate: 1,
  themeId: "study-green",
  lastEpisodeId: "ep1",
};

test("mergePlayerStates keeps the newest episode progress", () => {
  const incoming: LocalPlayerState = {
    ...baseState,
    progress: {
      ep1: {
        ...baseState.progress.ep1,
        position: 80,
        lastPlayedAt: "2026-07-17T01:00:00.000Z",
      },
    },
  };
  const merged = mergePlayerStates(baseState, incoming);
  assert.equal(merged.progress.ep1.position, 80);
});

test("mergePlayerStates can union favorites during device pairing", () => {
  const incoming: LocalPlayerState = {
    ...baseState,
    progress: {},
    favoriteBookIds: ["book2"],
    favoriteEpisodeIds: [],
  };
  const merged = mergePlayerStates(baseState, incoming, "union");
  assert.deepEqual(merged.favoriteBookIds.sort(), ["book1", "book2"]);
  assert.deepEqual(merged.favoriteEpisodeIds, ["ep1"]);
});

test("normalizePlayerState rejects malformed fields", () => {
  const normalized = normalizePlayerState({
    progress: { ep1: { bookId: 123, position: "bad" } },
    favoriteBookIds: ["book1", "book1", 3],
    favoriteEpisodeIds: "bad",
    playbackRate: 999,
  });
  assert.deepEqual(normalized.progress, {});
  assert.deepEqual(normalized.favoriteBookIds, ["book1"]);
  assert.deepEqual(normalized.favoriteEpisodeIds, []);
  assert.equal(normalized.playbackRate, 3);
  assert.equal(normalized.themeId, "study-green");
});

test("normalizePlayerState keeps a valid theme", () => {
  const normalized = normalizePlayerState({ themeId: "night-ink" });
  assert.equal(normalized.themeId, "night-ink");
});

test("mergePlayerStates keeps incoming theme selection", () => {
  const merged = mergePlayerStates(baseState, { ...baseState, themeId: "paper-warm" });
  assert.equal(merged.themeId, "paper-warm");
});
