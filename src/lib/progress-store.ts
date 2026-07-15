import { EMPTY_PLAYER_STATE } from "./progress-model";
import type { LocalPlayerState } from "./types";

const DB_NAME = "ai-narrator-player";
const STORE_NAME = "state";
const STATE_KEY = "player";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadPlayerState(): Promise<LocalPlayerState> {
  if (typeof indexedDB === "undefined") return { ...EMPTY_PLAYER_STATE };
  const db = await openDatabase();
  return new Promise<LocalPlayerState>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve({ ...EMPTY_PLAYER_STATE, ...(request.result ?? {}) });
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function savePlayerState(state: LocalPlayerState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}
