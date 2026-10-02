/** Keep source replacement and the play request in the same event turn. */
export function handoffAudio(
  audio: Pick<HTMLAudioElement, "src" | "playbackRate" | "load">,
  url: string,
  playbackRate: number,
  startPlayback?: () => void,
) {
  audio.src = url;
  audio.playbackRate = playbackRate;
  audio.load();
  startPlayback?.();
}
