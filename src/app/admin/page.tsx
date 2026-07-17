import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminNav } from "./admin-nav";
import { AdminLogoutButton } from "./comments/admin-comment-actions";
import "./admin.css";

const adminCards = [
  {
    href: "/admin/comments",
    eyebrow: "COMMENTS",
    title: "留言管理",
    description: "查看前台公開留言、感想與重大錯誤回報；必要時可調整狀態或刪除。",
  },
  {
    href: "/admin/wishes",
    eyebrow: "WISH POOL",
    title: "許願池",
    description: "查看使用者想聽的書與推薦理由，整理後續可製作的書單。",
  },
  {
    href: "/admin/devices",
    eyebrow: "DEVICES",
    title: "設備監控",
    description: "掌握匿名設備數與近期活躍狀況，不記錄書名、單集或播放進度。",
  },
];

export default async function AdminPage() {
  if (!await isAdminAuthenticated()) redirect("/admin/login");

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">ADMIN</p>
          <h1>管理後台</h1>
          <p>集中管理留言、許願池與匿名設備活動，方便控管私人播放器的使用狀況。</p>
        </div>
        <AdminLogoutButton />
      </header>

      <AdminNav active="dashboard" />

      <section className="admin-dashboard-grid" aria-label="後台功能入口">
        {adminCards.map((card) => (
          <Link key={card.href} href={card.href} className="admin-dashboard-card">
            <span>{card.eyebrow}</span>
            <b>{card.title}</b>
            <p>{card.description}</p>
          </Link>
        ))}
      </section>

      <section className="admin-panel admin-management-note">
        <h2>管理原則</h2>
        <p>後台只協助管理公開內容與匿名設備使用量。除非功能必要，不增加可識別個人或可追蹤閱讀內容的資料。</p>
      </section>
    </main>
  );
}
