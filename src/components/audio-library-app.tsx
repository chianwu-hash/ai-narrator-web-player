"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EMPTY_PLAYER_STATE, resumePosition, toggleBookFavorite, toggleEpisodeFavorite, upsertProgress } from "@/lib/progress-model";
import { loadPlayerState, savePlayerState } from "@/lib/progress-store";
import type { Book, Episode, LibraryResponse, LocalPlayerState } from "@/lib/types";
import "./audio-library-app.css";

type View = "home" | "library" | "favorites";

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

export function AudioLibraryApp() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingAutoplay = useRef(false);
  const lastSavedSecond = useRef(-1);
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

  const favoriteBooks = books.filter((book) => localState.favoriteBookIds.includes(book.id));
  const favoriteEpisodes = useMemo(() => books.flatMap((book) => book.episodes.map((episode) => ({ book, episode })))
    .filter(({ episode }) => localState.favoriteEpisodeIds.includes(episode.id)), [books, localState.favoriteEpisodeIds]);

  const recentBooks = useMemo(() => [...books].sort((a, b) => {
    const latest = (book: Book) => Math.max(0, ...book.episodes.map((episode) => Date.parse(localState.progress[episode.id]?.lastPlayedAt ?? "" ) || 0));
    return latest(b) - latest(a);
  }).filter((book) => book.episodes.some((episode) => localState.progress[episode.id])).slice(0, 4), [books, localState.progress]);

  const continueTarget = useMemo(() => {
    const saved = localState.lastEpisodeId;
    for (const book of books) {
      const episode = book.episodes.find((item) => item.id === saved);
      if (episode) return { book, episode };
    }
    return books[0]?.episodes[0] ? { book: books[0], episode: books[0].episodes[0] } : undefined;
  }, [books, localState.lastEpisodeId]);

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

  useEffect(() => {
    if (!activeBook || !activeEpisode || !("mediaSession" in navigator)) return;
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

  function showMessage(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 4200);
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
    window.setTimeout(() => {
      audioRef.current?.load();
      if (autoplay) void audioRef.current?.play().catch(() => undefined);
    }, 0);
  }

  function changeEpisode(offset: number) {
    if (!activeBook || !activeEpisode) return;
    const index = activeBook.episodes.findIndex((episode) => episode.id === activeEpisode.id);
    const next = activeBook.episodes[index + offset];
    if (next) { commitProgress(); startEpisode(activeBook, next, true); }
  }

  function togglePlay() {
    if (!activeEpisode && continueTarget) return startEpisode(continueTarget.book, continueTarget.episode, true);
    if (library?.source === "mock") return showMessage("示範書庫不含音檔；完成 Drive 設定後，播放與拖曳就會啟用。");
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => showMessage("瀏覽器暫時無法播放這個音檔。")); else audio.pause();
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

  function favoriteBook(id: string) { setLocalState((state) => toggleBookFavorite(state, id)); }
  function favoriteEpisode(id: string) { setLocalState((state) => toggleEpisodeFavorite(state, id)); }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand"><span className="brand-mark">▰</span><strong>AI 說書人</strong></div>
        <nav aria-label="主要導覽">
          <NavButton active={view === "home"} symbol="⌂" label="首頁" onClick={() => setView("home")} />
          <NavButton active={view === "library"} symbol="▤" label="全部書籍" onClick={() => setView("library")} />
          <NavButton active={view === "favorites"} symbol="♥" label="我的最愛" onClick={() => setView("favorites")} />
        </nav>
        <div className="side-note"><b>只存在這台裝置</b><span>進度與最愛不會跨裝置同步。</span></div>
        <button className="logout-button" onClick={logout}>登出</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p>歡迎回來</p><h1>{view === "home" ? "今天想聽哪一本？" : view === "library" ? "全部書籍" : "我的最愛"}</h1></div>
          <div className={library?.source === "drive" ? "source-badge connected" : "source-badge"}><span />{library?.source === "drive" ? "Drive 已連線" : "示範書庫"}</div>
        </header>

        {!ready && <div className="loading-state"><div className="loading-disc" /><p>正在整理你的書庫…</p></div>}
        {library?.notice && <div className="notice" role="status"><b>目前使用示範內容</b><span>{library.notice}</span></div>}

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
                  <button className="primary-button" onClick={() => startEpisode(continueTarget.book, continueTarget.episode, true)}><span>▶</span>{localState.progress[continueTarget.episode.id] ? "從上次進度繼續" : "開始收聽"}</button>
                </div>
              </section>
            )}
            <BookSection title="最近播放" books={recentBooks.length ? recentBooks : books.slice(0, 4)} localState={localState} onOpen={(book) => setSelectedBookId(book.id)} onFavorite={favoriteBook} />
            {favoriteBooks.length > 0 && <BookSection title="我的最愛" books={favoriteBooks.slice(0, 4)} localState={localState} onOpen={(book) => setSelectedBookId(book.id)} onFavorite={favoriteBook} />}
          </>
        )}

        {ready && view === "library" && (
          <BookSection title={`${books.length} 本書`} books={books} localState={localState} onOpen={(book) => setSelectedBookId(book.id)} onFavorite={favoriteBook} expanded />
        )}

        {ready && view === "favorites" && (
          <section>
            <BookSection title="收藏的書" books={favoriteBooks} localState={localState} onOpen={(book) => setSelectedBookId(book.id)} onFavorite={favoriteBook} expanded />
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
      </main>

      <nav className="mobile-nav" aria-label="行動版主要導覽">
        <NavButton active={view === "home"} symbol="⌂" label="首頁" onClick={() => setView("home")} />
        <NavButton active={view === "library"} symbol="▤" label="書庫" onClick={() => setView("library")} />
        <NavButton active={view === "favorites"} symbol="♥" label="最愛" onClick={() => setView("favorites")} />
      </nav>

      {selectedBook && (
        <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBookId(undefined); }}>
          <section className="book-sheet" aria-modal="true" role="dialog" aria-label={`${selectedBook.title}集數列表`}>
            <button className="sheet-close" onClick={() => setSelectedBookId(undefined)} aria-label="關閉">×</button>
            <div className="sheet-hero"><div className="sheet-cover"><BookCover book={selectedBook} /></div><div><p className="section-kicker">{selectedBook.episodes.length} 集</p><h2>{selectedBook.title}</h2><p>{selectedBook.subtitle ?? "挑一集開始，播放器會替你記住每次停下的位置。"}</p><button className="heart-button" onClick={() => favoriteBook(selectedBook.id)}>{localState.favoriteBookIds.includes(selectedBook.id) ? "♥ 已收藏" : "♡ 收藏整本"}</button></div></div>
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
                </div>;
              })}
            </div>
          </section>
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
            <button className="play-button" onClick={togglePlay} aria-label={playing ? "暫停" : "播放"}>{playing ? "Ⅱ" : "▶"}</button>
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
          <div className="full-controls"><button onClick={() => changeEpisode(-1)} aria-label="上一集">|◀</button><button onClick={() => seek(-15)} aria-label="倒退 15 秒">↶<small>15</small></button><button className="full-play" onClick={togglePlay}>{playing ? "Ⅱ" : "▶"}</button><button onClick={() => seek(30)} aria-label="快轉 30 秒">↷<small>30</small></button><button onClick={() => changeEpisode(1)} aria-label="下一集">▶|</button></div>
          <label className="rate-control">播放速度<select value={localState.playbackRate} onChange={(event) => changeRate(Number(event.target.value))}>{[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
        </section>
      )}

      <audio
        ref={audioRef}
        src={activeEpisode && library?.source === "drive" ? `/api/audio/${activeEpisode.id}` : undefined}
        preload="metadata"
        onLoadedMetadata={(event) => { const audio = event.currentTarget; const restored = resumePosition(activeProgress); audio.currentTime = restored; audio.playbackRate = localState.playbackRate; setPosition(restored); setDuration(audio.duration); if (pendingAutoplay.current) { pendingAutoplay.current = false; void audio.play().catch(() => undefined); } }}
        onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); commitProgress(); }}
        onTimeUpdate={(event) => { const audio = event.currentTarget; setPosition(audio.currentTime); setDuration(audio.duration); const second = Math.floor(audio.currentTime); if (second % 5 === 0 && second !== lastSavedSecond.current) { lastSavedSecond.current = second; commitProgress(); } }}
        onEnded={() => { commitProgress(true); setPlaying(false); changeEpisode(1); }}
        onError={() => showMessage("音訊讀取失敗，請檢查 Drive 權限或稍後再試。")}
      />
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
