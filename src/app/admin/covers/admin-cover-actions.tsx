"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_COVER_BYTES = 5 * 1024 * 1024;

export function AdminCoverUpload({ bookId, hasCover }: { bookId: string; hasCover: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  async function uploadCover() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setMessage("請先選擇 JPG、PNG 或 WebP 圖片。");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("只支援 JPG、PNG 或 WebP 圖片。");
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setMessage("圖片請小於 5 MB。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("cover", file);
      const response = await fetch(`/api/admin/covers/${encodeURIComponent(bookId)}`, {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "封面更新失敗。");
      setMessage("封面已更新。");
      if (inputRef.current) inputRef.current.value = "";
      setSelectedFileName("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "封面更新失敗。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-cover-actions">
      <input
        ref={inputRef}
        className="admin-cover-file-input"
        id={`cover-file-${bookId}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(event) => setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "")}
      />
      <label className="admin-cover-file-button" htmlFor={`cover-file-${bookId}`}>
        選擇圖片
      </label>
      <span className="admin-cover-file-name">{selectedFileName || "尚未選擇檔案"}</span>
      <button type="button" onClick={uploadCover} disabled={busy}>
        {busy ? "上傳中" : hasCover ? "替換封面" : "上傳封面"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}
