import Link from "next/link";
import { redirect } from "next/navigation";
import { isRequestAuthenticated } from "@/lib/auth";
import "./help.css";

export default async function HelpPage() {
  if (!await isRequestAuthenticated()) redirect("/login");

  return (
    <main className="help-shell">
      <section className="help-hero">
        <p className="help-eyebrow">HELP</p>
        <h1>播放器說明</h1>
        <p>這裡整理播放器、跨設備同步、留言回報、許願池與管理入口，方便日後自己維護，也方便親友理解使用規則。</p>
        <div className="help-actions">
          <Link href="/">回播放器</Link>
          <Link href="/admin">管理後台</Link>
        </div>
      </section>

      <section className="help-grid">
        <article>
          <h2>播放器</h2>
          <p>登入後可收聽目前書庫內容。播放器會記住本機播放進度；若開啟跨設備同步，進度與最愛會跟著已配對設備。</p>
        </article>
        <article>
          <h2>跨設備同步</h2>
          <p>第一台設備開啟同步後，可產生配對碼。新設備登入播放器後輸入配對碼，即可同步播放進度、最愛與頁面風格。</p>
        </article>
        <article>
          <h2>留言與回報</h2>
          <p>每本書或單集都能留下感想，或指出說書人的重大錯誤。使用同一瀏覽器可編輯或刪除自己的留言。</p>
        </article>
        <article>
          <h2>許願池</h2>
          <p>可匿名提出想聽的書與推薦理由。前台所有使用者都能看到許願內容，管理者可在後台整理狀態。</p>
        </article>
        <article>
          <h2>管理後台</h2>
          <p>管理者可查看留言、許願池與匿名設備使用量。設備監控只統計設備活動，不記錄書名、單集或播放進度。</p>
        </article>
        <article>
          <h2>使用聲明</h2>
          <p>本網站開發旨在個人研究與導讀，絕不是要取代閱讀；原書閱讀才能體會文字之美。請勿私自分享邀請碼或內容。</p>
        </article>
      </section>
    </main>
  );
}
