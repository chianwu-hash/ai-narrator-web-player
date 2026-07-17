# 架構與安全邊界

## 資料流

```text
瀏覽器 ──邀請碼──> Next.js 登入 API ──> HttpOnly session cookie
瀏覽器 ──已登入──> 書庫 API ──唯讀──> Google Drive API
HTML audio ─Range─> 音訊 API ─4 MiB Range─> Drive blob
瀏覽器 ──────────> IndexedDB（進度、最愛、播放速度）
```

所有 Google service account 憑證、Drive access token、邀請碼 hash 與 session secret 都只存在伺服器環境。前端只收到已過濾的書籍、集數與穩定 Drive file ID。每次音訊／封面請求還會確認檔案位於允許的根目錄之下，避免把代理端點變成任意 Drive 檔案下載器。

## Drive 索引規則

1. 只列出 `GOOGLE_DRIVE_ROOT_FOLDER_ID` 的直接子資料夾。
2. 每個子資料夾視為候選書籍；至少含一個允許的音訊 MIME type 才會成為書籍。
3. 音訊允許 MP3、M4A/MP4 audio、AAC、WAV、OGG、WebM。
4. 以明確名稱規則排除音樂、測試、暫存與工作檔。
5. 解析 `EP01`、`Episode 01`、`第 1 集` 或數字開頭；無法解析者排在已編號集數之後。
6. 使用 Drive file ID 作為書籍與單集 ID，重新命名後仍能保留進度。
7. 優先找名稱含 `cover` 或 `封面` 的圖片；沒有就使用書名字首的漸層封面。

目前既有輸出已確認為 `gdrive:aitalktoyou_book/<書名>/EP01_*.mp3`，符合這個索引模型。未改動既有 bot 或 Drive。

## 音訊策略

Google Drive blob 透過 `files.get?alt=media` 下載，Drive 支援 `Range` 部分下載。播放器把瀏覽器的 Range 請求限制為最多 4 MiB，再把 Drive 的 `206`、`Content-Range`、`Accept-Ranges` 回傳給瀏覽器，讓拖曳與長音訊不必一次穿過 Vercel Function。

這是 MVP 的最小可行方案。風險是所有音訊流量仍經 Vercel；大量或長時間收聽會增加流量與執行時間。上線後應觀察失敗率、Functions 用量與 iOS Safari 實機行為。若超出可接受範圍，再評估短效簽名 URL 加私有 CDN，而不是未說明就搬到另一個付費儲存服務。

## 本機資料

IndexedDB 儲存：書籍 ID、單集 ID、播放位置、長度、完成狀態、最後播放時間、書籍最愛、單集最愛與播放速度。播放中每五秒、暫停、切集、頁面進背景與離開時保存。距結尾 15 秒內或播放 98% 以上標記完成；再次播放已完成單集時從頭開始。

## 暫不實作

使用者帳號、跨裝置同步、付費、DRM、評論、推薦演算法、管理後台、Drive 寫入及 Telegram bot 變更。
