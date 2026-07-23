import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { commentsAvailable, listAdminContentComments } from "@/lib/comments-server";
import { deviceActivityAvailable, listAdminDeviceActivity } from "@/lib/device-activity-server";
import { listAdminBookWishes, wishesAvailable } from "@/lib/wishes-server";
import { AdminNav } from "./admin-nav";
import { AdminLogoutButton } from "./comments/admin-comment-actions";
import "./admin.css";

type AdminCard = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
};

async function safeCount<T>(enabled: boolean, loader: () => Promise<T[]>) {
  if (!enabled) return { value: "未設定", label: "資料庫尚未啟用" };
  try {
    const rows = await loader();
    return { value: String(rows.length), label: "待處理" };
  } catch {
    return { value: "—", label: "讀取失敗" };
  }
}

async function safeDeviceActivity() {
  if (!deviceActivityAvailable()) return { value: "未設定", label: "資料庫尚未啟用" };
  try {
    const activity = await listAdminDeviceActivity();
    return { value: String(activity.active24h), label: "24 小時活躍" };
  } catch {
    return { value: "—", label: "讀取失敗" };
  }
}

async function getAdminCards(): Promise<AdminCard[]> {
  const [newComments, newWishes, activeDevices] = await Promise.all([
    safeCount(commentsAvailable(), () => listAdminContentComments("new")),
    safeCount(wishesAvailable(), () => listAdminBookWishes("new")),
    safeDeviceActivity(),
  ]);

  return [
    {
      href: "/admin/covers",
      eyebrow: "COVERS",
      title: "書封整理",
      description: "檢查目前封面狀態，必要時手動上傳替換，讓播放器顯示正確版本。",
      stat: "Drive",
      statLabel: "手動整理",
    },
    {
      href: "/admin/comments",
      eyebrow: "COMMENTS",
      title: "留言管理",
      description: "查看前台公開留言、感想與重大錯誤回報；必要時可調整狀態或刪除。",
      stat: newComments.value,
      statLabel: newComments.label,
    },
    {
      href: "/admin/wishes",
      eyebrow: "WISH POOL",
      title: "許願池",
      description: "查看使用者想聽的書與推薦理由，整理後續可製作的書單。",
      stat: newWishes.value,
      statLabel: newWishes.label,
    },
    {
      href: "/admin/devices",
      eyebrow: "DEVICES",
      title: "設備監控",
      description: "掌握匿名設備數與近期活躍狀況，不記錄書名、單集或播放進度。",
      stat: activeDevices.value,
      statLabel: activeDevices.label,
    },
  ];
}

export default async function AdminPage() {
  if (!await isAdminAuthenticated()) redirect("/admin/login");
  const adminCards = await getAdminCards();

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
            <strong className="admin-dashboard-stat">{card.stat}</strong>
            <small>{card.statLabel}</small>
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
