import { redirect } from "next/navigation";
import { adminAuthConfigured, isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminLoginForm } from "./admin-login-form";
import "../admin.css";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");
  return (
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <p className="admin-eyebrow">ADMIN</p>
        <h1>留言管理後台</h1>
        <p>管理前台公開留言、錯誤回報與不適合公開的內容。</p>
        {adminAuthConfigured() ? <AdminLoginForm /> : (
          <div className="admin-warning">
            尚未設定管理者碼。請在 Vercel 環境變數加入 <code>ADMIN_ACCESS_CODE_SHA256</code>。
          </div>
        )}
      </section>
    </main>
  );
}
