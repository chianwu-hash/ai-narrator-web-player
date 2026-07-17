"use client";

import Image from "next/image";
import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EMPTY_PLAYER_STATE, resumePosition, toggleBookFavorite, toggleEpisodeFavorite, upsertProgress } from "@/lib/progress-model";
import { loadPlayerState, savePlayerState } from "@/lib/progress-store";
import type { Book, Episode, LibraryResponse, LocalPlayerState, ThemeId } from "@/lib/types";
import { SyncControls } from "./sync-controls";
import "./audio-library-app.css";

type View = "home" | "library" | "favorites" | "wishes";
type CommentType = "reflection" | "error_report" | "other";
type CommentTarget =
  | { targetType: "book"; book: Book }
  | { targetType: "episode"; book: Book; episode: Episode };
type CommentItem = {
  id: string;
  targetType: "book" | "episode";
  bookId: string;
  bookTitle: string;
  episodeId?: string;
  episodeTitle?: string;
  commentType: CommentType;
  body: string;
  createdAt: string;
  updatedAt?: string;
  canEdit: boolean;
};
type WishItem = {
  id: string;
  title: string;
  author?: string;
  reason: string;
  status: "new" | "reviewing" | "accepted" | "rejected" | "done";
  createdAt: string;
  coverUrl?: string;
};
type ThemeOption = {
  id: ThemeId;
  label: string;
  description: string;
  symbol: string;
};

const THEME_OPTIONS: ThemeOption[] = [
  { id: "study-green", label: "書房綠", description: "沉穩、私密，適合預設聽書。", symbol: "●" },
  { id: "paper-warm", label: "暖紙米", description: "像閱讀器的紙感，適合白天瀏覽。", symbol: "◇" },
  { id: "night-ink", label: "夜間墨", description: "低亮度深色，適合睡前收聽。", symbol: "◐" },
];

function formatTime(seconds = 0): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function BookCover({ book, priority = false }: { book: Book; priority?: boolean }) {
  if (book.coverFileId) {
    return <Image className="book-cover-image" src={`/api/cover/${book.coverFileId}`} alt={`${book.title}封面`} fill sizes="(max-width: 720px) 44vw, 190px" priority={priority} unoptimized />;
  }
  return (
    <div className="book-cover-fallback" aria-label={`${book.title}沒有封面`}>
      <span>{book.title.slice(0, 1)}</span>
      <small>AI AUDIO BOOK</small>
    </div>
  );
}

function NavButton({ active, symbol, label, onClick }: { active: boolean; symbol: string; label: string; onClick: () => void }) {
  return <button className={active ? "nav-button active" : "nav-button"} onClick={onClick} aria-current={active ? "page" : undefined}><span aria-hidden="true">{symbol}</span>{label}</button>;
}

function PlayerSpinner() {
  return <span className="player-spinner" aria-hidden="true" />;
}

function commentTypeLabel(type: CommentType): string {
  return type === "reflection" ? "感想" : type === "error_report" ? "錯誤回報" : "其他";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function wishStatusLabel(status: WishItem["status"]): string {
  if (status === "reviewing") return "考慮中";
  if (status === "accepted") return "已採納";
  if (status === "rejected") return "暫不製作";
  if (status === "done") return "已完成";
  return "新願望";
}

function wishBookStyle(wish: WishItem, index: number): CSSProperties {
  let hash = 0;
  for (const char of wish.id + wish.title) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  const x = 8 + (hash % 72);
  const y = 12 + ((hash >> 3) % 58);
  const rotation = -24 + ((hash >> 5) % 49);
  const size = 74 + ((hash + index * 13) % 28);
  return {
    "--wish-x": `${x}%`,
    "--wish-y": `${y}%`,
    "--wish-rotate": `${rotation}deg`,
    "--wish-unrotate": `${rotation * -1}deg`,
    "--wish-size": `${size}px`,
  } as CSSProperties;
}

export function AudioLibraryApp() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingAutoplay = useRef(false);
  const lastSavedSecond = useRef(-1);
  const loadingMessageTimer = useRef<number | undefined>(undefined);
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [localState, setLocalState] = useState<LocalPlayerState>(EMPTY_PLAYER_STATE);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [selectedBookId, setSelectedBookId] = useState<string>();
  const [activeBookId, setActiveBookId] = useState<string>();
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [commentTarget, setCommentTarget] = useState<CommentTarget>();
  const [commentType, setCommentType] = useState<CommentType>("reflection");
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [wishTitle, setWishTitle] = useState("");
  const [wishAuthor, setWishAuthor] = useState("");
  const [wishReason, setWishReason] = useState("");
  const [wishSubmitting, setWishSubmitting] = useState(false);
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [wishesLoading, setWishesLoading] = useState(false);
  const [wishesLoaded, setWishesLoaded] = useState(false);

  const startAudioLoading = useCallback(() => {
    setAudioLoading(true);
    if (loadingMessageTimer.current !== undefined) return;
    setSlowLoading(false);
    loadingMessageTimer.current = window.setTimeout(() => setSlowLoading(true), 2000);
  }, []);

  const stopAudioLoading = useCallback(() => {
    if (loadingMessageTimer.current !== undefined) window.clearTimeout(loadingMessageTimer.current);
    loadingMessageTimer.current = undefined;
    setAudioLoading(false);
    setSlowLoading(false);
  }, []);

  useEffect(() => () => {
    if (loadingMessageTimer.current !== undefined) window.clearTimeout(loadingMessageTimer.current);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/library").then(async (response) => {
        if (response.status === 401) { router.replace("/login"); throw new Error("未登入"); }
        return response.json() as Promise<LibraryResponse>;
      }),
      loadPlayerState(),
    ]).then(([nextLibrary, saved]) => {
      setLibrary(nextLibrary);
      setLocalState(saved);
      const lastEpisodeId = saved.lastEpisodeId;
      const lastBook = nextLibrary.books.find((book) => book.episodes.some((episode) => episode.id === lastEpisodeId));
      if (lastBook && lastEpisodeId) { setActiveBookId(lastBook.id); setActiveEpisodeId(lastEpisodeId); }
      setReady(true);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "書庫載入失敗"));
  }, [router]);

  useEffect(() => {
    if (ready) void savePlayerState(localState);
  }, [localState, ready]);

  const books = useMemo(() => library?.books ?? [], [library]);
  const selectedBook = books.find((book) => book.id === selectedBookId);
  const activeBook = books.find((book) => book.id === activeBookId);
  const activeEpisode = activeBook?.episodes.find((episode) => episode.id === activeEpisodeId);
  const activeProgress = activeEpisode ? localState.progress[activeEpisode.id] : undefined;
  const selectedBookComments = selectedBook ? comments.filter((comment) => comment.bookId === selectedBook.id) : [];
  const activeTheme = localState.themeId;

  const favoriteBooks = books.filter((book) => localState.favoriteBookIds.includes(book.id));
  const favoriteEpisodes = useMemo(() => books.flatMap((book) => book.episodes.map((episode) => ({ book, episode })))
    .filter(({ episode }) => localState.favoriteEpisodeIds.includes(episode.id)), [books, localState.favoriteEpisodeIds]);

  const recentBooks = useMemo(() => [...books].sort((a, b) => {
    const latest = (book: Book) => Math.max(0, ...book.episodes.map((episode) => Date.parse(localState.progress[episode.id]?.lastPlayedAt ?? "" ) || 0));
    return latest(b) - latest(a);
  }).filter((book) => book.episodes.some((episode) => localState.progress[episode.id])).slice(0, 4), [books, localState.progress]);

  const continueTarget = (() => {
    const saved = localState.lastEpisodeId;
    for (const book of books) {
      const episode = book.episodes.find((item) => item.id === saved);
      if (episode) return { book, episode };
    }
    return books[0]?.episodes[0] ? { book: books[0], episode: books[0].episodes[0] } : undefined;
  })();

  async function refreshComments(bookId: string) {
    setCommentsLoading(true);
    try {
      const response = await fetch(`/api/comments?bookId=${encodeURIComponent(bookId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "留言讀取失敗。");
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "留言讀取失敗。");
    } finally {
      setCommentsLoading(false);
    }
  }

  async function refreshWishes() {
    setWishesLoading(true);
    try {
      const response = await fetch("/api/wishes");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "願望讀取失敗。");
      setWishes(Array.isArray(data.wishes) ? data.wishes : []);
      setWishesLoaded(true);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "願望讀取失敗。");
    } finally {
      setWishesLoading(false);
    }
  }

  const commitProgress = useCallback((completed?: boolean) => {
    const audio = audioRef.current;
    if (!activeBook || !activeEpisode) return;
    const nextPosition = audio?.currentTime ?? position;
    const nextDuration = audio?.duration && Number.isFinite(audio.duration) ? audio.duration : duration || activeEpisode.duration || 0;
    setLocalState((state) => upsertProgress(state, {
      episodeId: activeEpisode.id, bookId: activeBook.id, position: nextPosition,
      duration: nextDuration, completed,
    }));
  }, [activeBook, activeEpisode, duration, position]);

  useEffect(() => {
    function persistWhenHidden() { if (document.visibilityState === "hidden") commitProgress(); }
    function persistOnPageHide() { commitProgress(); }
    window.addEventListener("pagehide", persistOnPageHide);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => { window.removeEventListener("pagehide", persistOnPageHide); document.removeEventListener("visibilitychange", persistWhenHidden); };
  }, [commitProgress]);

  function showMessage(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 4200);
  }

  function requestAudioPlay(audio: HTMLAudioElement) {
    startAudioLoading();
    void audio.play().catch(() => {
      pendingAutoplay.current = false;
      stopAudioLoading();
      showMessage("瀏覽器暫時無法播放這個音檔。");
    });
  }

  function startEpisode(book: Book, episode: Episode, autoplay = true) {
    setActiveBookId(book.id);
    setActiveEpisodeId(episode.id);
    setSelectedBookId(undefined);
    setPosition(localState.progress[episode.id]?.position ?? 0);
    setDuration(localState.progress[episode.id]?.duration || episode.duration || 0);
    pendingAutoplay.current = autoplay;
    if (library?.source === "mock") {
      showMessage("目前是示範書庫；連接 Google Drive 後即可播放真實音訊。");
      return;
    }
    if (autoplay) startAudioLoading();
    window.setTimeout(() => {
      audioRef.current?.load();
      if (autoplay && audioRef.current) requestAudioPlay(audioRef.current);
    }, 0);
  }

  function changeEpisode(offset: number) {
    if (!activeBook || !activeEpisode) return;
    const index = activeBook.episodes.findIndex((episode) => episode.id === activeEpisode.id);
    const next = activeBook.episodes[index + offset];
    if (next) { commitProgress(); startEpisode(activeBook, next, true); }
  }

  useEffect(() => {
    if (!activeBook || !activeEpisode || !("mediaSession" in navigator)) return;
    // eslint-disable-next-line react-hooks/immutability
    navigator.mediaSession.metadata = new MediaMetadata({ title: activeEpisode.title, artist: `第 ${activeEpisode.number} 集`, album: activeBook.title });
    const audio = audioRef.current;
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Browser does not expose this action. */ }
    };
    setHandler("play", () => void audio?.play());
    setHandler("pause", () => audio?.pause());
    setHandler("seekbackward", () => { if (audio) audio.currentTime = Math.max(0, audio.currentTime - 15); });
    setHandler("seekforward", () => { if (audio) audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 30); });
    setHandler("previoustrack", () => changeEpisode(-1));
    setHandler("nexttrack", () => changeEpisode(1));
  // changeEpisode intentionally uses the latest render when metadata changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBook, activeEpisode]);

  function togglePlay() {
    if (!activeEpisode && continueTarget) return startEpisode(continueTarget.book, continueTarget.episode, true);
    if (library?.source === "mock") return showMessage("示範書庫不含音檔；完成 Drive 設定後，播放與拖曳就會啟用。");
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) requestAudioPlay(audio); else audio.pause();
  }

  function seek(delta: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + delta));
    setPosition(audio.currentTime);
  }

  function changeRate(value: number) {
    setLocalState((state) => ({ ...state, playbackRate: value }));
    if (audioRef.current) audioRef.current.playbackRate = value;
  }

  function changeTheme(themeId: ThemeId) {
    setLocalState((state) => ({ ...state, themeId }));
  }

  function favoriteBook(id: string) { setLocalState((state) => toggleBookFavorite(state, id)); }
  function favoriteEpisode(id: string) { setLocalState((state) => toggleEpisodeFavorite(state, id)); }

  function openBook(book: Book) {
    setSelectedBookId(book.id);
    void refreshComments(book.id);
  }

  function openWishes() {
    setView("wishes");
    if (!wishesLoaded) void refreshWishes();
  }

  function openComment(target: CommentTarget) {
    setCommentTarget(target);
    setCommentType(target.targetType === "episode" ? "error_report" : "reflection");
    setCommentBody("");
    setEditingCommentId(undefined);
  }

  function editComment(comment: CommentItem) {
    if (!selectedBook) return;
    const episode = comment.episodeId ? selectedBook.episodes.find((item) => item.id === comment.episodeId) : undefined;
    if (comment.targetType === "episode" && !episode) return;
    setCommentTarget(comment.targetType === "episode" && episode
      ? { targetType: "episode", book: selectedBook, episode }
      : { targetType: "book", book: selectedBook });
    setCommentType(comment.commentType);
    setCommentBody(comment.body);
    setEditingCommentId(comment.id);
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentTarget || commentBody.trim().length < 4) return;
    setCommentSubmitting(true);
    try {
      const response = await fetch("/api/comments", {
        method: editingCommentId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingCommentId,
          targetType: commentTarget.targetType,
          bookId: commentTarget.book.id,
          bookTitle: commentTarget.book.title,
          episodeId: commentTarget.targetType === "episode" ? commentTarget.episode.id : undefined,
          episodeTitle: commentTarget.targetType === "episode" ? commentTarget.episode.title : undefined,
          commentType,
          body: commentBody,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "留言送出失敗。");
      setCommentTarget(undefined);
      setCommentBody("");
      setEditingCommentId(undefined);
      await refreshComments(commentTarget.book.id);
      showMessage(editingCommentId ? "留言已更新。" : "已收到留言。");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "留言送出失敗。");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function deleteComment(comment: CommentItem) {
    if (!selectedBook || !window.confirm("確定要刪除這則留言嗎？")) return;
    try {
      const response = await fetch(`/api/comments?id=${encodeURIComponent(comment.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "留言刪除失敗。");
      await refreshComments(selectedBook.id);
      showMessage("留言已刪除。");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "留言刪除失敗。");
    }
  }

  async function submitWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (wishTitle.trim().length < 2 || wishReason.trim().length < 4) return;
    setWishSubmitting(true);
    try {
      const response = await fetch("/api/wishes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: wishTitle,
          author: wishAuthor,
          reason: wishReason,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "許願送出失敗。");
      setWishTitle("");
      setWishAuthor("");
      setWishReason("");
      await refreshWishes();
      showMessage("已收到願望，管理者會作為後續製書參考。");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "許願送出失敗。");
    } finally {
      setWishSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell" data-theme={activeTheme}>
      <aside className="side-nav">
        <div className="brand"><span className="brand-mark">▰</span><strong>AI 說書人</strong></div>
        <nav aria-label="主要導覽">
          <NavButton active={view === "home"} symbol="⌂" label="首頁" onClick={() => setView("home")} />
          <NavButton active={view === "library"} symbol="▤" label="全部書籍" onClick={() => setView("library")} />
          <NavButton active={view === "favorites"} symbol="♥" label="我的最愛" onClick={() => setView("favorites")} />
          <NavButton active={view === "wishes"} symbol="✦" label="許願池" onClick={openWishes} />
        </nav>
        <div className="side-note"><b>可跨設備同步</b><span>開啟同步後，進度與最愛會跟著已配對設備。</span></div>
        <button className="logout-button" onClick={logout}>登出</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p>歡迎回來</p><h1>{view === "home" ? "今天想聽哪一本？" : view === "library" ? "全部書籍" : view === "favorites" ? "我的最愛" : "許願池"}</h1></div>
          <div className={library?.source === "drive" ? "source-badge connected" : "source-badge"}><span />{library?.source === "drive" ? "Drive 已連線" : "示範書庫"}</div>
        </header>

        {!ready && <div className="loading-state"><div className="loading-disc" /><p>正在整理你的書庫…</p></div>}
        {library?.notice && <div className="notice" role="status"><b>目前使用示範內容</b><span>{library.notice}</span></div>}
        {ready && <SyncControls ready={ready} localState={localState} onStateMerged={setLocalState} onNotify={showMessage} />}
        {ready && (
          <section className="theme-panel" aria-label="播放器風格選擇">
            <div className="theme-copy">
              <b>播放器風格</b>
              <span>選擇會保存在這台裝置；開啟同步後也會跟著同步。</span>
            </div>
            <div className="theme-options">
              {THEME_OPTIONS.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={activeTheme === theme.id ? "theme-option active" : "theme-option"}
                  onClick={() => changeTheme(theme.id)}
                  aria-pressed={activeTheme === theme.id}
                >
                  <span aria-hidden="true">{theme.symbol}</span>
                  <b>{theme.label}</b>
                  <small>{theme.description}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {ready && view === "home" && (
          <>
            {continueTarget && (
              <section className="continue-card">
                <div className="continue-art"><BookCover book={continueTarget.book} priority /></div>
                <div className="continue-copy">
                  <p className="section-kicker">繼續收聽</p>
                  <h2>{continueTarget.book.title}</h2>
                  <p>第 {continueTarget.episode.number} 集 · {continueTarget.episode.title}</p>
                  <div className="continue-progress"><span style={{ width: `${Math.min(100, ((localState.progress[continueTarget.episode.id]?.position ?? 0) / (localState.progress[continueTarget.episode.id]?.duration || continueTarget.episode.duration || 1)) * 100)}%` }} /></div>
                  <button className="primary-button" onClick={() => startEpisode(continueTarget.book, continueTarget.episode, true)} disabled={audioLoading && activeEpisodeId === continueTarget.episode.id} aria-busy={audioLoading && activeEpisodeId === continueTarget.episode.id}>
                    {audioLoading && activeEpisodeId === continueTarget.episode.id ? <PlayerSpinner /> : <span>▶</span>}
                    {audioLoading && activeEpisodeId === continueTarget.episode.id ? "正在載入" : localState.progress[continueTarget.episode.id] ? "從上次進度繼續" : "開始收聽"}
                  </button>
                </div>
              </section>
            )}
            <BookSection title="最近播放" books={recentBooks.length ? recentBooks : books.slice(0, 4)} localState={localState} onOpen={openBook} onFavorite={favoriteBook} />
            {favoriteBooks.length > 0 && <BookSection title="我的最愛" books={favoriteBooks.slice(0, 4)} localState={localState} onOpen={openBook} onFavorite={favoriteBook} />}
          </>
        )}

        {ready && view === "library" && (
          <BookSection title={`${books.length} 本書`} books={books} localState={localState} onOpen={openBook} onFavorite={favoriteBook} expanded />
        )}

        {ready && view === "favorites" && (
          <section>
            <BookSection title="收藏的書" books={favoriteBooks} localState={localState} onOpen={openBook} onFavorite={favoriteBook} expanded />
            <div className="episode-favorites">
              <div className="section-heading"><h2>收藏的單集</h2><span>{favoriteEpisodes.length} 集</span></div>
              {favoriteEpisodes.map(({ book, episode }) => (
                <button className="favorite-episode-row" key={episode.id} onClick={() => startEpisode(book, episode, true)}>
                  <span className="episode-number">{String(episode.number).padStart(2, "0")}</span>
                  <span><b>{episode.title}</b><small>{book.title}</small></span><span aria-hidden="true">▶</span>
                </button>
              ))}
              {!favoriteBooks.length && !favoriteEpisodes.length && <EmptyState />}
            </div>
          </section>
        )}

        {ready && view === "wishes" && (
          <section className="wish-panel">
            <div className="wish-copy">
              <p className="section-kicker">WISH POOL</p>
              <h2>想聽哪一本書？</h2>
              <p>可以不記名留下書名與推薦理由。這裡不是保證製作清單，而是協助管理者判斷下一批值得製作的內容。</p>
            </div>
            <form className="wish-form" onSubmit={submitWish}>
              <label>想聽的書名
                <input value={wishTitle} onChange={(event) => setWishTitle(event.target.value.slice(0, 160))} minLength={2} maxLength={160} required placeholder="例如：原子習慣" />
              </label>
              <label>作者，可不填
                <input value={wishAuthor} onChange={(event) => setWishAuthor(event.target.value.slice(0, 100))} maxLength={100} placeholder="例如：James Clear" />
              </label>
              <label>推薦理由
                <textarea value={wishReason} onChange={(event) => setWishReason(event.target.value.slice(0, 1000))} minLength={4} maxLength={1000} required placeholder="為什麼想聽這本？適合誰？哪個觀點值得被說書？" />
              </label>
              <div className="wish-form-footer">
                <span>{wishReason.length}/1000</span>
                <button type="submit" disabled={wishSubmitting || wishTitle.trim().length < 2 || wishReason.trim().length < 4}>{wishSubmitting ? "送出中…" : "送出願望"}</button>
              </div>
            </form>
            <div className="wish-pool-wrap">
              <div className="section-heading"><h2>大家的願望</h2><span>{wishesLoading ? "讀取中" : `${wishes.length} 本`}</span></div>
              <div className="wish-pool" aria-label="大家許願想聽的書">
                <svg className="wish-pool-svg" viewBox="0 0 900 430" role="img" aria-label="許願池">
                  <defs>
                    <radialGradient id="poolGlow" cx="50%" cy="42%" r="64%">
                      <stop offset="0%" stopColor="#bde9df" />
                      <stop offset="58%" stopColor="#5aa99a" />
                      <stop offset="100%" stopColor="#1d5b4f" />
                    </radialGradient>
                    <linearGradient id="poolEdge" x1="0%" x2="100%">
                      <stop offset="0%" stopColor="#f8efe0" />
                      <stop offset="52%" stopColor="#fffaf0" />
                      <stop offset="100%" stopColor="#ead9bb" />
                    </linearGradient>
                  </defs>
                  <ellipse cx="450" cy="232" rx="405" ry="154" fill="url(#poolEdge)" />
                  <ellipse cx="450" cy="218" rx="358" ry="122" fill="url(#poolGlow)" />
                  <path d="M118 217c78-48 156-54 235-17 84 40 178 39 280-4 55-24 103-25 149-4" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="12" strokeLinecap="round" />
                  <path d="M178 261c73 25 146 21 219-11 68-29 146-25 234 13 34 15 66 19 96 12" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="8" strokeLinecap="round" />
                  <ellipse cx="450" cy="218" rx="358" ry="122" fill="none" stroke="rgba(20,69,61,.28)" strokeWidth="3" />
                </svg>
                {wishes.map((wish, index) => (
                  <article className="wish-book" key={wish.id} style={wishBookStyle(wish, index)} title={`${wish.title}${wish.author ? `｜${wish.author}` : ""}`}>
                    <div className="wish-book-cover">
                      {wish.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={wish.coverUrl} alt={`${wish.title}封面`} loading="lazy" />
                      ) : <div className="wish-book-fallback"><span>{wish.title.slice(0, 1)}</span><small>WISH</small></div>}
                    </div>
                    <div className="wish-book-info">
                      <b>{wish.title}</b>
                      <small>{wish.author ?? "作者未填"} · {wishStatusLabel(wish.status)}</small>
                      <p>{wish.reason}</p>
                    </div>
                  </article>
                ))}
                {!wishesLoading && wishes.length === 0 && <div className="wish-pool-empty">目前還沒有願望。可以先丟第一本書進池裡。</div>}
              </div>
              <p className="wish-pool-note">封面由公開書籍資料來源自動比對；若找不到封面，會顯示站內預設書封。</p>
              {wishes.length > 0 && (
                <div className="wish-public-list" aria-label="許願內容清單">
                  {wishes.map((wish) => (
                    <article key={`list-${wish.id}`} className="wish-public-card">
                      <b>{wish.title}</b>
                      <span>{wish.author ? `作者：${wish.author}` : "作者未填"} · {wishStatusLabel(wish.status)}</span>
                      <p>{wish.reason}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <nav className="mobile-nav" aria-label="行動版主要導覽">
        <NavButton active={view === "home"} symbol="⌂" label="首頁" onClick={() => setView("home")} />
        <NavButton active={view === "library"} symbol="▤" label="書庫" onClick={() => setView("library")} />
        <NavButton active={view === "favorites"} symbol="♥" label="最愛" onClick={() => setView("favorites")} />
        <NavButton active={view === "wishes"} symbol="✦" label="許願" onClick={openWishes} />
      </nav>

      {selectedBook && (
        <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBookId(undefined); }}>
          <section className="book-sheet" aria-modal="true" role="dialog" aria-label={`${selectedBook.title}集數列表`}>
            <button className="sheet-close" onClick={() => setSelectedBookId(undefined)} aria-label="關閉">×</button>
            <div className="sheet-hero"><div className="sheet-cover"><BookCover book={selectedBook} /></div><div><p className="section-kicker">{selectedBook.episodes.length} 集</p><h2>{selectedBook.title}</h2><p>{selectedBook.subtitle ?? "挑一集開始，播放器會替你記住每次停下的位置。"}</p><div className="sheet-actions"><button className="heart-button" onClick={() => favoriteBook(selectedBook.id)}>{localState.favoriteBookIds.includes(selectedBook.id) ? "♥ 已收藏" : "♡ 收藏整本"}</button><button className="feedback-button" onClick={() => openComment({ targetType: "book", book: selectedBook })}>留言 / 回報</button></div></div></div>
            <div className="episode-list">
              {selectedBook.episodes.map((episode) => {
                const progress = localState.progress[episode.id];
                return <div className="episode-row" key={episode.id}>
                  <button className="episode-main" onClick={() => startEpisode(selectedBook, episode, true)}>
                    <span className="episode-number">{String(episode.number).padStart(2, "0")}</span>
                    <span><b>{episode.title}</b><small>{progress?.completed ? "已聽完" : progress ? `${formatTime(progress.position)} / ${formatTime(progress.duration)}` : "尚未收聽"}</small></span>
                    <span className="row-play" aria-hidden="true">▶</span>
                  </button>
                  <button className="row-favorite" onClick={() => favoriteEpisode(episode.id)} aria-label={localState.favoriteEpisodeIds.includes(episode.id) ? "移除單集收藏" : "收藏單集"}>{localState.favoriteEpisodeIds.includes(episode.id) ? "♥" : "♡"}</button>
                  <button className="row-comment" onClick={() => openComment({ targetType: "episode", book: selectedBook, episode })} aria-label={`留言或回報 ${episode.title}`}>✎</button>
                </div>;
              })}
            </div>
            <section className="comments-section">
              <div className="section-heading"><h2>留言與回報</h2><span>{commentsLoading ? "讀取中" : `${selectedBookComments.length} 則`}</span></div>
              {selectedBookComments.length ? <div className="comment-list">{selectedBookComments.map((comment) => (
                <article className="comment-card" key={comment.id}>
                  <div className="comment-meta">
                    <span>{comment.targetType === "episode" ? `單集：${comment.episodeTitle ?? ""}` : "整本書"}</span>
                    <span>{commentTypeLabel(comment.commentType)}</span>
                    <time>{formatDateTime(comment.updatedAt ?? comment.createdAt)}{comment.updatedAt ? " 編輯" : ""}</time>
                  </div>
                  <p>{comment.body}</p>
                  {comment.canEdit && <div className="comment-actions"><button onClick={() => editComment(comment)}>編輯</button><button onClick={() => void deleteComment(comment)}>刪除</button></div>}
                </article>
              ))}</div> : <p className="comment-empty">{commentsLoading ? "正在讀取留言…" : "還沒有留言。可以留下感想，或回報說書人的重大錯誤。"}</p>}
            </section>
          </section>
        </div>
      )}

      {commentTarget && (
        <div className="comment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommentTarget(undefined); }}>
          <form className="comment-dialog" onSubmit={submitComment} aria-label="留言或錯誤回報">
            <button type="button" className="comment-close" onClick={() => setCommentTarget(undefined)} aria-label="關閉">×</button>
            <p className="section-kicker">{commentTarget.targetType === "episode" ? "單集回饋" : "書籍回饋"}</p>
            <h2>{commentTarget.targetType === "episode" ? commentTarget.episode.title : commentTarget.book.title}</h2>
            <small>{commentTarget.book.title}</small>
            <label>留言類型<select value={commentType} onChange={(event) => setCommentType(event.target.value as CommentType)}>
              <option value="reflection">感想</option>
              <option value="error_report">重大錯誤回報</option>
              <option value="other">其他</option>
            </select></label>
            <label>內容<textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value.slice(0, 1000))} minLength={4} maxLength={1000} required placeholder="可以留下感想，也可以指出說書人理解錯誤、人物關係錯誤、章節重點偏掉等問題。" /></label>
            <div className="comment-footer"><span>{commentBody.length}/1000</span><button type="submit" disabled={commentSubmitting || commentBody.trim().length < 4}>{commentSubmitting ? "送出中…" : editingCommentId ? "更新留言" : "送出留言"}</button></div>
          </form>
        </div>
      )}

      {activeBook && activeEpisode && (
        <div className="mini-player">
          <button className="mini-main" onClick={() => setExpanded(true)}>
            <div className="mini-cover"><BookCover book={activeBook} /></div>
            <span><b>{activeEpisode.title}</b><small>{activeBook.title}</small></span>
          </button>
          <div className="mini-controls">
            <button className="mini-skip" onClick={() => seek(-15)} aria-label="倒退 15 秒">↶<small>15</small></button>
            <button className="play-button" onClick={togglePlay} disabled={audioLoading} aria-busy={audioLoading} aria-label={audioLoading ? "正在載入音訊" : playing ? "暫停" : "播放"}>{audioLoading ? <PlayerSpinner /> : playing ? "Ⅱ" : "▶"}</button>
            <button className="mini-skip" onClick={() => seek(30)} aria-label="快轉 30 秒">↷<small>30</small></button>
          </div>
          <div className="mini-timeline"><span style={{ width: `${duration ? position / duration * 100 : 0}%` }} /></div>
        </div>
      )}

      {expanded && activeBook && activeEpisode && (
        <section className="full-player" aria-modal="true" role="dialog" aria-label="完整播放器">
          <header><button onClick={() => setExpanded(false)} aria-label="收合播放器">⌄</button><span>正在播放</span><button onClick={() => favoriteEpisode(activeEpisode.id)} aria-label="收藏單集">{localState.favoriteEpisodeIds.includes(activeEpisode.id) ? "♥" : "♡"}</button></header>
          <div className="full-cover"><BookCover book={activeBook} /></div>
          <div className="full-copy"><p>{activeBook.title}</p><h2>{activeEpisode.title}</h2><span>第 {activeEpisode.number} 集</span></div>
          <div className="scrubber"><input aria-label="播放位置" type="range" min="0" max={duration || 1} value={Math.min(position, duration || 1)} onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setPosition(value); }} /><div><span>{formatTime(position)}</span><span>-{formatTime(Math.max(0, duration - position))}</span></div></div>
          <div className="full-controls"><button onClick={() => changeEpisode(-1)} aria-label="上一集">|◀</button><button onClick={() => seek(-15)} aria-label="倒退 15 秒">↶<small>15</small></button><button className="full-play" onClick={togglePlay} disabled={audioLoading} aria-busy={audioLoading} aria-label={audioLoading ? "正在載入音訊" : playing ? "暫停" : "播放"}>{audioLoading ? <PlayerSpinner /> : playing ? "Ⅱ" : "▶"}</button><button onClick={() => seek(30)} aria-label="快轉 30 秒">↷<small>30</small></button><button onClick={() => changeEpisode(1)} aria-label="下一集">▶|</button></div>
          <label className="rate-control">播放速度<select value={localState.playbackRate} onChange={(event) => changeRate(Number(event.target.value))}>{[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
        </section>
      )}

      <audio
        ref={audioRef}
        src={activeEpisode && library?.source === "drive" ? `/api/audio/${activeEpisode.id}` : undefined}
        preload="metadata"
        onLoadedMetadata={(event) => { const audio = event.currentTarget; const restored = resumePosition(activeProgress); audio.currentTime = restored; audio.playbackRate = localState.playbackRate; setPosition(restored); setDuration(audio.duration); if (pendingAutoplay.current) { pendingAutoplay.current = false; requestAudioPlay(audio); } }}
        onPlay={() => { pendingAutoplay.current = false; setPlaying(true); }}
        onPlaying={() => { stopAudioLoading(); setPlaying(true); }}
        onWaiting={() => startAudioLoading()}
        onStalled={(event) => { if (!event.currentTarget.paused) startAudioLoading(); }}
        onPause={() => { pendingAutoplay.current = false; stopAudioLoading(); setPlaying(false); commitProgress(); }}
        onTimeUpdate={(event) => { const audio = event.currentTarget; setPosition(audio.currentTime); setDuration(audio.duration); const second = Math.floor(audio.currentTime); if (second % 5 === 0 && second !== lastSavedSecond.current) { lastSavedSecond.current = second; commitProgress(); } }}
        onEnded={() => { stopAudioLoading(); commitProgress(true); setPlaying(false); changeEpisode(1); }}
        onError={() => { pendingAutoplay.current = false; stopAudioLoading(); showMessage("音訊讀取失敗，請檢查 Drive 權限或稍後再試。"); }}
      />
      {slowLoading && !message && <div className="toast audio-loading-toast" role="status"><PlayerSpinner />正在載入音訊…</div>}
      {message && <div className="toast" role="status">{message}</div>}
    </div>
  );
}

function BookSection({ title, books, localState, onOpen, onFavorite, expanded = false }: { title: string; books: Book[]; localState: LocalPlayerState; onOpen: (book: Book) => void; onFavorite: (id: string) => void; expanded?: boolean }) {
  return (
    <section className="book-section">
      <div className="section-heading"><h2>{title}</h2><span>{books.length ? "依書籍整理" : "尚無內容"}</span></div>
      {books.length ? <div className={expanded ? "book-grid expanded" : "book-grid"}>{books.map((book) => {
        const listened = book.episodes.filter((episode) => localState.progress[episode.id]?.completed).length;
        return <article className="book-card" key={book.id}>
          <button className="cover-button" onClick={() => onOpen(book)}><BookCover book={book} /></button>
          <button className="card-favorite" onClick={() => onFavorite(book.id)} aria-label={localState.favoriteBookIds.includes(book.id) ? `取消收藏${book.title}` : `收藏${book.title}`}>{localState.favoriteBookIds.includes(book.id) ? "♥" : "♡"}</button>
          <button className="book-meta" onClick={() => onOpen(book)}><b>{book.title}</b><span>{book.episodes.length} 集{listened ? ` · ${listened} 集已聽完` : ""}</span></button>
        </article>;
      })}</div> : <EmptyState />}
    </section>
  );
}

function EmptyState() {
  return <div className="empty-state"><span>♡</span><h3>這裡還是空的</h3><p>在書籍或單集旁點一下愛心，就能快速回到喜歡的內容。</p></div>;
}
