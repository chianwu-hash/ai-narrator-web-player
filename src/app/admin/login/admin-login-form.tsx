"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        setError(result.error ?? "登入失敗，請確認管理者碼。");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-login-form">
      <label htmlFor="admin-code">管理者碼</label>
      <input
        id="admin-code"
        type="password"
        autoComplete="current-password"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
        autoFocus
        placeholder="輸入管理者碼"
      />
      {error && <p className="admin-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || !code}>{busy ? "登入中…" : "進入後台"}</button>
    </form>
  );
}
