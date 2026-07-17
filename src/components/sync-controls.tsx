"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergePlayerStates } from "@/lib/player-state-merge";
import type { LocalPlayerState } from "@/lib/types";

type SyncControlsProps = {
  ready: boolean;
  localState: LocalPlayerState;
  onStateMerged: (state: LocalPlayerState) => void;
  onNotify: (message: string) => void;
};

type SyncStatus = "checking" | "disabled" | "unlinked" | "linked" | "syncing" | "error";

type SyncResponse = {
  enabled?: boolean;
  linked?: boolean;
  state?: LocalPlayerState;
  syncedAt?: string;
  error?: string;
};

async function readJson(response: Response): Promise<SyncResponse> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "同步失敗");
  return data;
}

export function SyncControls({ ready, localState, onStateMerged, onNotify }: SyncControlsProps) {
  const [status, setStatus] = useState<SyncStatus>("checking");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [showClaim, setShowClaim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const localStateRef = useRef(localState);
  const lastUploadedJson = useRef("");
  const uploadTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    localStateRef.current = localState;
  }, [localState]);

  const applySyncedState = useCallback((data: SyncResponse, favoriteMode: "incoming" | "union" = "union") => {
    if (data.state) {
      const merged = mergePlayerStates(data.state, localStateRef.current, favoriteMode);
      onStateMerged(merged);
      lastUploadedJson.current = JSON.stringify(data.state);
    }
    if (data.syncedAt) setLastSyncedAt(data.syncedAt);
  }, [onStateMerged]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/sync/state")
      .then(readJson)
      .then((data) => {
        if (cancelled) return;
        if (data.enabled === false) {
          setStatus("disabled");
          return;
        }
        if (!data.linked) {
          setStatus("unlinked");
          return;
        }
        applySyncedState(data, "union");
        setStatus("linked");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [applySyncedState, ready]);

  useEffect(() => {
    if (!ready || (status !== "linked" && status !== "syncing")) return;
    const payload = JSON.stringify(localState);
    if (payload === lastUploadedJson.current) return;
    if (uploadTimer.current !== undefined) window.clearTimeout(uploadTimer.current);
    setStatus("syncing");
    uploadTimer.current = window.setTimeout(() => {
      fetch("/api/sync/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: localState }),
      })
        .then(readJson)
        .then((data) => {
          if (data.enabled === false) {
            setStatus("disabled");
            return;
          }
          lastUploadedJson.current = JSON.stringify(data.state ?? localState);
          if (data.syncedAt) setLastSyncedAt(data.syncedAt);
          setStatus("linked");
        })
        .catch(() => setStatus("error"));
    }, 1200);
    return () => {
      if (uploadTimer.current !== undefined) window.clearTimeout(uploadTimer.current);
    };
  }, [localState, ready, status]);

  async function enableSync() {
    setBusy(true);
    try {
      const data = await fetch("/api/sync/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: localState }),
      }).then(readJson);
      if (data.enabled === false) {
        setStatus("disabled");
        onNotify("Supabase 尚未設定");
        return;
      }
      applySyncedState(data, "union");
      setStatus("linked");
      onNotify("已開啟跨設備同步");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "同步開啟失敗");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  async function startPairing() {
    setBusy(true);
    try {
      const data = await fetch("/api/sync/pairing/start", { method: "POST" }).then(async (response) => {
        const parsed = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof parsed.error === "string" ? parsed.error : "配對碼產生失敗");
        if (parsed.enabled === false) throw new Error("Supabase 尚未設定");
        return parsed as { code: string; expiresAt: string };
      });
      setPairingCode(data.code);
      setPairingExpiresAt(data.expiresAt);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "配對碼產生失敗");
    } finally {
      setBusy(false);
    }
  }

  async function claimPairing() {
    setBusy(true);
    try {
      const data = await fetch("/api/sync/pairing/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: claimCode, state: localState }),
      }).then(readJson);
      if (data.enabled === false) {
        setStatus("disabled");
        onNotify("Supabase 尚未設定");
        return;
      }
      applySyncedState(data, "union");
      setStatus("linked");
      setShowClaim(false);
      setClaimCode("");
      onNotify("這台設備已連結到同步進度");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "配對失敗");
    } finally {
      setBusy(false);
    }
  }

  const syncedTime = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "";
  const statusLabel =
    status === "disabled" ? "Supabase 尚未設定" :
    status === "unlinked" ? "尚未開啟跨設備同步" :
    status === "syncing" ? "同步中" :
    status === "linked" ? `已同步${syncedTime ? ` ${syncedTime}` : ""}` :
    status === "error" ? "同步暫時失敗" : "檢查同步狀態";

  return (
    <section className={`sync-panel ${status === "linked" || status === "syncing" ? "linked" : ""}`} aria-label="跨設備同步">
      <div className="sync-copy">
        <strong>跨設備同步</strong>
        <span>{statusLabel}</span>
      </div>
      {status === "unlinked" || status === "error" ? (
        <div className="sync-actions">
          <button type="button" onClick={enableSync} disabled={busy}>開啟同步</button>
          <button type="button" className="ghost" onClick={() => setShowClaim((value) => !value)} disabled={busy}>輸入配對碼</button>
        </div>
      ) : null}
      {status === "linked" || status === "syncing" ? (
        <div className="sync-actions">
          <button type="button" onClick={startPairing} disabled={busy}>連結新設備</button>
        </div>
      ) : null}
      {showClaim && (
        <form className="sync-claim" onSubmit={(event) => { event.preventDefault(); void claimPairing(); }}>
          <input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={claimCode} onChange={(event) => setClaimCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 位數配對碼" />
          <button type="submit" disabled={busy || claimCode.length !== 6}>連結</button>
        </form>
      )}
      {pairingCode && (
        <div className="pairing-code" role="status">
          <span>新設備輸入</span>
          <strong>{pairingCode}</strong>
          <small>{pairingExpiresAt ? `有效到 ${new Date(pairingExpiresAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}` : "5 分鐘內有效"}</small>
        </div>
      )}
    </section>
  );
}
