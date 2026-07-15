"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        setError(result.error ?? "登入失敗，請稍後再試。");
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="login-form">
      <label htmlFor="access-code">共用認證碼</label>
      <input
        id="access-code" type="password" autoComplete="current-password" inputMode="text"
        value={code} onChange={(event) => setCode(event.target.value)} required autoFocus
        placeholder="請輸入認證碼"
      />
      {error && <p className="login-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || !code}>{busy ? "驗證中…" : "進入書庫"}</button>
    </form>
  );
}
