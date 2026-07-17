import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { commentsAvailable, listAdminContentComments } from "@/lib/comments-server";
import { AdminNav } from "../admin-nav";
import { AdminCommentActions, AdminLogoutButton } from "./admin-comment-actions";
import "../admin.css";

type CommentStatusFilter = "new" | "reviewing" | "resolved" | "ignored" | "all";
type AdminComment = Awaited<ReturnType<typeof listAdminContentComments>>[number];

const filters: { value: CommentStatusFilter; label: string }[] = [
  { value: "new", label: "新留言" },
  { value: "reviewing", label: "處理中" },
  { value: "resolved", label: "已解決" },
  { value: "ignored", label: "已隱藏" },
  { value: "all", label: "全部" },
];

function statusLabel(status: string): string {
  return filters.find((item) => item.value === status)?.label ?? status;
}

function commentTypeLabel(type: string): string {
  if (type === "reflection") return "感想";
  if (type === "error_report") return "錯誤回報";
  return "其他";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normalizeStatus(value: string | string[] | undefined): CommentStatusFilter {
  const status = Array.isArray(value) ? value[0] : value;
  return filters.some((item) => item.value === status) ? status as CommentStatusFilter : "new";
}

function CommentCard({ comment }: { comment: AdminComment }) {
  return (
    <article className="admin-comment-card">
      <div className="admin-comment-topline">
        <span>{statusLabel(comment.status)}</span>
        <span>{commentTypeLabel(comment.commentType)}</span>
        <time>{formatDateTime(comment.createdAt)}</time>
      </div>
      <h2>{comment.targetType === "episode" ? comment.episodeTitle : comment.bookTitle}</h2>
      <p className="admin-comment-book">{comment.targetType === "episode" ? comment.bookTitle : "整本書留言"}</p>
      <p className="admin-comment-body">{comment.body}</p>
      <div className="admin-comment-foot">
        <span>{comment.hasAuthorToken ? "可由原瀏覽器自行編輯/刪除" : "舊留言：沒有原作者瀏覽器標記"}</span>
        {comment.updatedAt && <span>更新：{formatDateTime(comment.updatedAt)}</span>}
      </div>
      <AdminCommentActions id={comment.id} status={comment.status} />
    </article>
  );
}

export default async function AdminCommentsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] | undefined }> }) {
  if (!await isAdminAuthenticated()) redirect("/admin/login");
  const params = await searchParams;
  const status = normalizeStatus(params?.status);
  let comments: AdminComment[] = [];
  let error = "";

  if (!commentsAvailable()) {
    error = "留言功能尚未設定 Supabase。";
  } else {
    try {
      comments = await listAdminContentComments(status);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "留言讀取失敗。";
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">COMMENTS</p>
          <h1>留言管理後台</h1>
          <p>只管理留言內容，不記錄使用者聽了什麼書。</p>
        </div>
        <AdminLogoutButton />
      </header>

      <AdminNav active="comments" />

      <nav className="admin-filters" aria-label="留言狀態">
        {filters.map((item) => (
          <Link key={item.value} className={item.value === status ? "active" : ""} href={`/admin/comments?status=${item.value}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>{statusLabel(status)}</h2>
          <span>{comments.length} 則</span>
        </div>
        {error && <div className="admin-warning">{error}</div>}
        {!error && comments.length === 0 && <div className="admin-empty">目前沒有這個狀態的留言。</div>}
        <div className="admin-comment-list">
          {comments.map((comment) => <CommentCard key={comment.id} comment={comment} />)}
        </div>
      </section>
    </main>
  );
}
