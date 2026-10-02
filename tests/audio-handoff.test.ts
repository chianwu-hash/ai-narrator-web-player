import assert from "node:assert/strict";
import test from "node:test";
import { handoffAudio } from "../src/lib/audio-handoff.ts";

test("換集只載入一次，並在同一輪依序設定來源、倍速、播放", () => {
  const events: string[] = [];
  const audio = {
    set src(url: string) { events.push(`src:${url}`); },
    set playbackRate(rate: number) { events.push(`rate:${rate}`); },
    load() { events.push("load"); },
  };
  handoffAudio(audio, "next.mp3", 1.5, () => events.push("play"));
  assert.deepEqual(events, ["src:next.mp3", "rate:1.5", "load", "play"]);
});

test("使用者已暫停時，更換來源不會自動呼叫播放", () => {
  let loads = 0;
  const audio = { src: "old.mp3", playbackRate: 1, load() { loads++; } };
  handoffAudio(audio, "new.mp3", 1.25);
  assert.equal(audio.src, "new.mp3");
  assert.equal(audio.playbackRate, 1.25);
  assert.equal(loads, 1);
});

test("連續換集沿用相同音訊元素，每集各發出一次播放請求", () => {
  const sources: string[] = [];
  const audio = { src: "", playbackRate: 1, load() {} };
  const play = () => sources.push(audio.src);
  handoffAudio(audio, "ep2.mp3", 1, play);
  handoffAudio(audio, "ep3.mp3", 1, play);
  assert.deepEqual(sources, ["ep2.mp3", "ep3.mp3"]);
});
