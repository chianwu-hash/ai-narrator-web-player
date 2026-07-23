import Image from "next/image";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { buildDriveLibrary, DriveApiError, isDriveConfigured } from "@/lib/google-drive";
import type { Book } from "@/lib/types";
import { AdminNav } from "../admin-nav";
import { AdminLogoutButton } from "../comments/admin-comment-actions";
import { AdminCoverUpload } from "./admin-cover-actions";
import "../admin.css";

function coverStatus(book: Book): string {
  if (!book.coverFileId) return "尚無封面";
  if (book.coverVersion) return "Drive 封面";
  return "已有封面";
}

function coverSrc(book: Book): string | undefined {
  if (!book.coverFileId) return undefined;
  const version = book.coverVersion ? `?v=${encodeURIComponent(book.coverVersion)}` : "";
  return `/api/cover/${book.coverFileId}${version}`;
}

function CoverPreview({ book }: { book: Book }) {
  const src = coverSrc(book);
  if (src) {
    return (
      <div className="admin-cover-preview">
        <Image src={src} alt={`${book.title}封面`} fill sizes="140px" unoptimized />
      </div>
    );
  }
  return (
    <div className="admin-cover-preview admin-cover-preview-fallback">
      <span>{book.title.slice(0, 1)}</span>
      <small>AI AUDIO BOOK</small>
    </div>
  );
}

function CoverCard({ book }: { book: Book }) {
  return (
    <article className="admin-cover-card">
      <CoverPreview book={book} />
      <div className="admin-cover-info">
        <div className="admin-comment-topline">
          <span>{coverStatus(book)}</span>
          <span>{book.episodes.length} 集</span>
        </div>
        <h2>{book.title}</h2>
        <p>上傳新封面後會寫回 Google Drive；播放器下次載入書庫時會帶入新的封面版本。</p>
        <AdminCoverUpload bookId={book.id} hasCover={Boolean(book.coverFileId)} />
      </div>
    </article>
  );
}

export default async function AdminCoversPage() {
  if (!await isAdminAuthenticated()) redirect("/admin/login");
  let books: Book[] = [];
  let error = "";

  if (!isDriveConfigured()) {
    error = "Google Drive 書庫尚未設定。";
  } else {
    try {
      books = await buildDriveLibrary();
    } catch (caught) {
      error = caught instanceof DriveApiError || caught instanceof Error ? caught.message : "書庫讀取失敗。";
    }
  }

  const missingCoverCount = books.filter((book) => !book.coverFileId).length;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">COVERS</p>
          <h1>書封整理</h1>
          <p>手動替換播放器封面。這裡只處理 Drive 書庫中的封面檔，不改動音檔與播放紀錄。</p>
        </div>
        <AdminLogoutButton />
      </header>

      <AdminNav active="covers" />

      <section className="admin-device-stats" aria-label="書封統計">
        <div><b>{books.length}</b><span>書籍總數</span></div>
        <div><b>{books.length - missingCoverCount}</b><span>已有封面</span></div>
        <div><b>{missingCoverCount}</b><span>待補封面</span></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>全部書籍</h2>
          <span>{books.length} 本</span>
        </div>
        {error && <div className="admin-warning">{error}</div>}
        {!error && books.length === 0 && <div className="admin-empty">目前沒有可整理的 Drive 書籍。</div>}
        <div className="admin-cover-list">
          {books.map((book) => <CoverCard key={book.id} book={book} />)}
        </div>
      </section>
    </main>
  );
}
