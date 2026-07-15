import { redirect } from "next/navigation";
import { isRequestAuthenticated } from "@/lib/auth";
import { LoginForm } from "./login-form";
import "./login.css";

export default async function LoginPage() {
  if (await isRequestAuthenticated()) redirect("/");
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-mark" aria-hidden="true">▰</div>
        <p className="login-eyebrow">PRIVATE LISTENING SPACE</p>
        <h1 id="login-title">AI 說書人</h1>
        <p className="login-copy">輸入管理者提供的認證碼，回到上次停下的地方。</p>
        <LoginForm />
        <p className="login-note">收聽進度與最愛只會保存在這台裝置的這個瀏覽器。</p>
      </section>
    </main>
  );
}
