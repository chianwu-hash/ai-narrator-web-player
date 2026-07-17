import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAdminBookWishes, wishesAvailable } from "@/lib/wishes-server";
import { AdminLogoutButton } from "../comments/admin-comment-actions";
import { AdminWishActions } from "./admin-wish-actions";
import "../admin.css";

type WishStatusFilter = "new" | "reviewing" | "accepted" | "rejected" | "done" | "all";
type AdminWish = Awaited<ReturnType<typeof listAdminBookWishes>>[number];

const filters: { value: WishStatusFilter; label: string }[] = [
  { value: "new", label: "新願望" },
  { value: "reviewing", label: "考慮中" },
  { value: "accepted", label: "已採納" },
  { value: "rejected", label: "暫不製作" },
  { value: "done", label: "已完成" },
  { value: "all", label: "全部" },
];

function statusLabel(status: string): string {
  return filters.find((item) => item.value === status)?.label ?? status;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normalizeStatus(value: string | string[] | undefined): WishStatusFilter {
  const status = Array.isArray(value) ? value[0] : value;
  return filters.some((item) => item.value === status) ? status as WishStatusFilter : "new";
}

function WishCard({ wish }: { wish: AdminWish }) {
  return (
    <article className="admin-comment-card">
      <div className="admin-comment-topline">
        <span>{statusLabel(wish.status)}</span>
        <time>{formatDateTime(wish.createdAt)}</time>
      </div>
      <h2>{wish.title}</h2>
      <p className="admin-comment-book">{wish.author ? `作者：${wish.author}` : "未填作者"}</p>
      <p className="admin-comment-body">{wish.reason}</p>
      <div className="admin-comment-foot">
        <span>不記名願望</span>
        {wish.updatedAt && <span>更新：{formatDateTime(wish.updatedAt)}</span>}
      </div>
      <AdminWishActions id={wish.id} status={wish.status} />
    </article>
  );
}

export default async function AdminWishesPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] | undefined }> }) {
  if (!await isAdminAuthenticated()) redirect("/admin/login");
  const params = await searchParams;
  const status = normalizeStatus(params?.status);
  let wishes: AdminWish[] = [];
  let error = "";

  if (!wishesAvailable()) {
    error = "許願池尚未設定 Supabase。";
  } else {
    try {
      wishes = await listAdminBookWishes(status);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "願望讀取失敗。";
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">WISH POOL</p>
          <h1>許願池管理</h1>
          <p>整理親友想聽的書與推薦理由，作為後續製書參考。</p>
        </div>
        <AdminLogoutButton />
      </header>

      <div className="admin-section-links" aria-label="後台功能">
        <Link href="/admin/comments">留言管理</Link>
        <Link href="/admin/wishes" className="active">許願池</Link>
        <Link href="/admin/devices">設備監控</Link>
      </div>

      <nav className="admin-filters" aria-label="願望狀態">
        {filters.map((item) => (
          <Link key={item.value} className={item.value === status ? "active" : ""} href={`/admin/wishes?status=${item.value}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>{statusLabel(status)}</h2>
          <span>{wishes.length} 筆</span>
        </div>
        {error && <div className="admin-warning">{error}</div>}
        {!error && wishes.length === 0 && <div className="admin-empty">目前沒有這個狀態的願望。</div>}
        <div className="admin-comment-list">
          {wishes.map((wish) => <WishCard key={wish.id} wish={wish} />)}
        </div>
      </section>
    </main>
  );
}
