"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WishStatus = "new" | "reviewing" | "accepted" | "rejected" | "done";

const statuses: { value: WishStatus; label: string }[] = [
  { value: "new", label: "新願望" },
  { value: "reviewing", label: "考慮中" },
  { value: "accepted", label: "已採納" },
  { value: "rejected", label: "暫不製作" },
  { value: "done", label: "已完成" },
];

export function AdminWishActions({ id, status }: { id: string; status: WishStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function updateStatus(nextStatus: WishStatus) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/wishes", {
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

  async function deleteWish() {
    if (!window.confirm("確定要刪除這筆願望嗎？")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/wishes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
      <select value={status} onChange={(event) => void updateStatus(event.target.value as WishStatus)} disabled={busy}>
        {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <button type="button" onClick={() => void updateStatus("accepted")} disabled={busy || status === "accepted"}>採納</button>
      <button type="button" className="danger" onClick={() => void deleteWish()} disabled={busy}>刪除</button>
      {message && <small role="alert">{message}</small>}
    </div>
  );
}
