# 架構與安全邊界

最後核對：2026-07-25

## 資料流

```text
一般使用者
  瀏覽器 ──邀請碼──> Next.js 登入 API ──> HttpOnly listener session
  瀏覽器 ──已登入──> 書庫 API ──唯讀──> Google Drive API
  書庫 API ──簽發短效 URL──> Cloudflare Worker audio URL
  HTML audio ─Range─> Cloudflare Worker ─4 MiB Range─> Drive 音檔
  瀏覽器 ──────────> IndexedDB（進度、最愛、倍速、主題）
  瀏覽器 ──已登入──> 同步／留言／許願／活動／排行 API ──> Supabase
  許願 API ──書名與作者查詢──> Open Library（只取得公開封面網址）

管理者
  瀏覽器 ──管理者碼──> Next.js 管理登入 API ──> 獨立 HttpOnly admin session
  管理後台 ──管理操作──> 留言／許願／設備 API ──> Supabase
  書封後台 ──明確上傳──> 封面 API ──新增或更新封面──> Google Drive
```

Google service account 憑證、Drive access token、Supabase secret key、邀請碼 hash、管理者碼 hash 與 session secret 都只存在伺服器環境。前端只收到已過濾的書籍、集數、穩定 Drive file ID、短效簽章音訊 URL，以及各功能需要的公開資料。Supabase 不由瀏覽器直接存取，所有讀寫都經過 Next.js API。

一般使用者與管理者使用不同 cookie 和驗證範圍，兩者不能互相替代。每次簽發音訊 URL、封面讀取或封面更新都會再次確認目標位於允許的 Drive 根目錄範圍內，避免把代理端點變成任意 Drive 檔案存取器。

## Drive 索引規則

1. 只列出 `GOOGLE_DRIVE_ROOT_FOLDER_ID` 的直接子資料夾。
2. 每個子資料夾視為候選書籍；至少含一個允許的音訊 MIME type 才會成為書籍。
3. 音訊允許 MP3、M4A/MP4 audio、AAC、WAV、OGG、WebM。
4. 以明確名稱規則排除音樂、測試、暫存與工作檔。
5. 解析 `EP01`、`Episode 01`、`第 1 集` 或數字開頭；無法解析者排在已編號集數之後。
6. 使用 Drive file ID 作為書籍與單集 ID，重新命名後仍能保留進度。
7. 優先找名稱含 `cover` 或 `封面` 的圖片；沒有就使用書名字首的漸層封面。

既有製書輸出為 `gdrive:aitalktoyou_book/<書名>/EP01_*.mp3`，符合這個索引模型。網站不會操作 Telegram bot。

## 音訊策略

正式環境的音訊 bytes 不應穿過 Vercel Functions。Vercel 在書庫 API 中為已登入使用者簽發短效 Cloudflare Worker URL；Worker 驗證 HMAC、期限與 Origin，透過 Vercel token broker 取得短效 Drive readonly token，再把瀏覽器的 Range 請求限制為最多 4 MiB，並將 Drive 的 `206`、`Content-Range`、`Accept-Ranges` 回傳給瀏覽器。

未設定 `AUDIO_WORKER_URL` 與有效 `AUDIO_SIGNING_SECRET` 的環境會回退到舊 Vercel audio route，主要作為本機或 Preview 驗證用途，不是正式大量播放路徑。

為降低不必要流量，播放器不再預抓下一集音訊，也不在首頁載入時立刻把 `<audio src>` 指向音訊；只有實際播放時才設定來源。若 URL 過期或失效，播放器只補發一次。

驗收重點是 production `currentSrc` 指向 Cloudflare Worker，拖曳與播放 Range 回應為 `206`，且 Vercel `/api/audio/[fileId]` 不再是主要音訊 bytes 路徑。完整切換手冊見 `docs/VERCEL_HOBBY_TRAFFIC_FIX.md`。

## 本機資料

IndexedDB 儲存：書籍 ID、單集 ID、播放位置、長度、完成狀態、最後播放時間、書籍最愛、單集最愛、播放速度、播放器風格與最後播放單集。播放中每五秒、暫停、切集、頁面進背景與離開時保存。距結尾 15 秒內或播放 98% 以上標記完成；再次播放已完成單集時從頭開始。

啟用跨設備同步後，以上播放狀態會合併至匿名 Supabase profile。每台瀏覽器持有獨立的 HttpOnly 同步設備 token；新設備以 6 位數、5 分鐘有效的一次性配對碼加入。共用邀請碼不作為個人同步身份。

## Supabase 功能與隱私

- `sync_*`：匿名 profile、設備、播放狀態與配對碼。
- `content_comments`：公開書籍／單集留言。新留言綁定雜湊後的匿名作者 token，讓同一瀏覽器可編輯或刪除自己的留言。
- `book_wishes`：公開許願內容與管理狀態，不要求姓名。
- `device_activity`：匿名設備雜湊、粗略設備／瀏覽器類型及首次、最後活動時間。
- `content_play_stats`：內容層級的書籍／單集累積播放次數。

設備監控不記錄書名、單集或播放進度；播放排行不記錄使用者、設備、IP 或個人進度。管理者可在獨立後台處理留言與許願、查看匿名設備統計。

## Drive 寫入邊界

一般書庫、音訊和封面存取為唯讀。唯一的網站 Drive 寫入入口是 `/admin/covers`：

1. 需要有效的管理者 session。
2. 只接受小於 5 MB 的 JPG、PNG 或 WebP。
3. 只允許根目錄直接子資料夾中的書籍。
4. 有現存封面時更新該檔案；沒有時新增標準 `cover.*`。
5. 不移動、不重新命名、不刪除書籍、音訊或其他 Drive 檔案。

因此只使用播放器時，service account 可為檢視者；要啟用書封管理，必須給指定書庫根資料夾編輯權限。

## 目前未實作

- 個人帳號、Email 登入或 OAuth；目前是共用邀請碼加匿名同步 profile。
- 付費、DRM、公開註冊與公開投票。
- 個人化推薦演算法；目前只有最近新增、最近播放與匿名熱門排行。
- 完整管理操作稽核。
- 後台直接修改邀請碼；仍由 Vercel 環境變數與版本號管理。
- 網站內的 Telegram bot 操作或製書流程。
