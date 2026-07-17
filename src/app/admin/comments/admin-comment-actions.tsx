"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CommentStatus = "new" | "reviewing" | "resolved" | "ignored";

const statuses: { value: CommentStatus; label: string }[] = [
  { value: "new", label: "新留言" },
  { value: "reviewing", label: "處理中" },
  { value: "resolved", label: "已解決" },
  { value: "ignored", label: "隱藏" },
];

export function AdminCommentActions({ id, status }: { id: string; status: CommentStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function updateStatus(nextStatus: CommentStatus) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/comments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "更新失敗。");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment() {
    if (!window.confirm("確定要刪除這則留言嗎？刪除後前台與後台列表都不會顯示。")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "刪除失敗。");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-comment-actions">
      <select value={status} onChange={(event) => void updateStatus(event.target.value as CommentStatus)} disabled={busy}>
        {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <button type="button" onClick={() => void updateStatus("ignored")} disabled={busy || status === "ignored"}>隱藏</button>
      <button type="button" className="danger" onClick={() => void deleteComment()} disabled={busy}>刪除</button>
      {message && <small role="alert">{message}</small>}
    </div>
  );
}

export function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" className="admin-logout" onClick={() => void logout()} disabled={busy}>{busy ? "登出中…" : "登出"}</button>;
}
