export const SYNC_UPLOAD_DEBOUNCE_MS = 1_200;
export const SYNC_UPLOAD_MIN_INTERVAL_MS = 60_000;

export function nextSyncUploadDelay(lastUploadAt: number, now = Date.now()): number {
  return Math.max(SYNC_UPLOAD_DEBOUNCE_MS, lastUploadAt + SYNC_UPLOAD_MIN_INTERVAL_MS - now);
}
